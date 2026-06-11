import { useEffect, useMemo, useRef, useState } from 'react';
import { GitCompareArrows, Plus, Search, X } from 'lucide-react';
import { ChartDownloadButton } from './ChartDownloadButton';
import { useUrlSync } from '../lib/urlState';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from 'recharts';
import { SkeletonLoader } from './SkeletonLoader';
import { apiJson, apiUrl } from '../lib/ideamApi';
import { datasetUnit, unitSuffix } from '../lib/units';
import type {
  AnalyticsByStationResponse,
  AnalyticsStationRow,
  AnalyticsTimeseriesResponse,
  IdfResponse,
  MetaResponse,
} from '../../shared/ideamContracts';

const PRECIP_DATASET = 's54a-sgyg';

export const COMPARADOR_STORAGE_KEY = 'ideam-comparador';
const MAX_STATIONS = 5;
const SERIES_COLORS = ['#C9A227', '#A3161A', '#2563eb', '#0d9488', '#7c3aed'];

interface StationLite {
  codigo: string;
  nombre: string;
  municipio: string;
  departamento: string;
}

function readStoredCodes(): string[] {
  try {
    const raw = JSON.parse(window.localStorage.getItem(COMPARADOR_STORAGE_KEY) || '[]');
    return Array.isArray(raw) ? raw.slice(0, MAX_STATIONS).map(String) : [];
  } catch {
    return [];
  }
}

function formatValue(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  if (abs >= 100) return value.toLocaleString('es-CO', { maximumFractionDigits: 1 });
  if (abs >= 1) return value.toLocaleString('es-CO', { maximumFractionDigits: 2 });
  return value.toLocaleString('es-CO', { maximumFractionDigits: 4 });
}

export function ComparadorEstaciones() {
  const chartRef = useRef<HTMLDivElement>(null);
  const idfChartRef = useRef<HTMLDivElement>(null);
  const [datasets, setDatasets] = useState<Array<{ id: string; name: string }>>([]);
  const [datasetId, setDatasetId] = useState('s54a-sgyg');
  const [catalog, setCatalog] = useState<StationLite[]>([]);
  const [selectedCodes, setSelectedCodes] = useState<string[]>(readStoredCodes);
  const [query, setQuery] = useState('');
  const [seriesByCode, setSeriesByCode] = useState<Record<string, AnalyticsTimeseriesResponse>>({});
  const [stationStats, setStationStats] = useState<AnalyticsStationRow[]>([]);
  const [idfByCode, setIdfByCode] = useState<Record<string, IdfResponse>>({});
  const [idfTr, setIdfTr] = useState(10); // período de retorno para comparar curvas IDF
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Estado en la URL: ?var=<dataset>&est=COD1,COD2&tr=10 (defaults omitidos).
  useUrlSync({
    params: {
      var: datasetId === 's54a-sgyg' ? undefined : datasetId,
      est: selectedCodes.length ? selectedCodes.join(',') : undefined,
      tr: idfTr === 10 ? undefined : String(idfTr),
    },
    onRestore: (p) => {
      if (p.var) setDatasetId(p.var);
      // La URL tiene prioridad sobre los códigos guardados en localStorage.
      if (p.est) setSelectedCodes(p.est.split(',').filter(Boolean));
      if (p.tr && Number.isFinite(Number(p.tr))) setIdfTr(Number(p.tr));
    },
  });

  // Catálogo ligero para el buscador (stations.geojson ya viene cacheado 24h).
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [stationsResponse, meta] = await Promise.all([
          fetch(apiUrl('/api/stations.geojson'), { headers: { accept: 'application/json' } }),
          apiJson<MetaResponse>('/api/meta', undefined, 'No fue posible cargar la metadata.'),
        ]);
        if (!stationsResponse.ok) throw new Error('No fue posible cargar el catálogo de estaciones.');
        const geo = (await stationsResponse.json()) as {
          features: Array<{ properties: { codigo: string; nombre: string | null; municipio: string | null; departamento: string | null } }>;
        };
        if (cancelled) return;
        setCatalog(
          geo.features.map((f) => ({
            codigo: f.properties.codigo,
            nombre: f.properties.nombre || f.properties.codigo,
            municipio: f.properties.municipio || 'N/D',
            departamento: f.properties.departamento || 'N/D',
          }))
        );
        setDatasets(meta.datasets.map((d) => ({ id: d.id, name: d.name })));
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'No fue posible cargar el catálogo.');
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Persistencia (y puerta de entrada desde el popup del mapa).
  useEffect(() => {
    try {
      window.localStorage.setItem(COMPARADOR_STORAGE_KEY, JSON.stringify(selectedCodes));
    } catch {
      // best-effort
    }
  }, [selectedCodes]);

  // Series + estadísticos de las estaciones elegidas.
  useEffect(() => {
    if (!selectedCodes.length) {
      setSeriesByCode({});
      setStationStats([]);
      return;
    }
    const controller = new AbortController();
    const load = async () => {
      setIsLoading(true);
      setError('');
      try {
        const [stats, ...series] = await Promise.all([
          apiJson<AnalyticsByStationResponse>(
            '/api/analytics/by-station',
            {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ datasetId, departments: [], catalogFilters: { stations: selectedCodes } }),
              signal: controller.signal,
            },
            'No fue posible cargar los estadísticos.'
          ),
          ...selectedCodes.map((code) =>
            apiJson<AnalyticsTimeseriesResponse>(
              '/api/analytics/timeseries',
              {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                  datasetId,
                  departments: [],
                  catalogFilters: { stations: [code] },
                  interval: 'year',
                  metric: 'avg',
                }),
                signal: controller.signal,
              },
              'No fue posible cargar una serie.'
            )
          ),
        ]);
        if (controller.signal.aborted) return;
        setStationStats(stats.stations);
        setSeriesByCode(Object.fromEntries(selectedCodes.map((code, index) => [code, series[index]])));
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : 'No fue posible cargar la comparación.');
        }
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    };
    void load();
    return () => controller.abort();
  }, [datasetId, selectedCodes.join('|')]);

  // Curvas IDF por estación (solo precipitación): 1 llamada por estación, sin
  // mezclar series crudas (cada IDF es puntual) → comparación válida.
  useEffect(() => {
    if (datasetId !== PRECIP_DATASET || !selectedCodes.length) {
      setIdfByCode({});
      return;
    }
    const controller = new AbortController();
    const load = async () => {
      const results = await Promise.all(
        selectedCodes.map((code) =>
          apiJson<IdfResponse>(
            '/api/analytics/idf',
            {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ datasetId, departments: [], catalogFilters: { stations: [code] } }),
              signal: controller.signal,
            },
            'Sin IDF.'
          ).catch(() => null)
        )
      );
      if (controller.signal.aborted) return;
      const map: Record<string, IdfResponse> = {};
      selectedCodes.forEach((code, i) => {
        if (results[i]) map[code] = results[i] as IdfResponse;
      });
      setIdfByCode(map);
    };
    void load();
    return () => controller.abort();
  }, [datasetId, selectedCodes.join('|')]);

  const suggestions = useMemo(() => {
    const q = query.trim().toUpperCase();
    if (q.length < 2) return [];
    return catalog
      .filter(
        (s) =>
          !selectedCodes.includes(s.codigo) &&
          (s.codigo.includes(q) || s.nombre.toUpperCase().includes(q) || s.municipio.toUpperCase().includes(q))
      )
      .slice(0, 8);
  }, [catalog, query, selectedCodes]);

  const chartData = useMemo(() => {
    const byYear = new Map<string, Record<string, number | string>>();
    for (const code of selectedCodes) {
      for (const point of seriesByCode[code]?.points || []) {
        if (point.value === null) continue;
        const year = point.bucket.slice(0, 4);
        const row = byYear.get(year) || { year };
        row[code] = point.value;
        byYear.set(year, row);
      }
    }
    return Array.from(byYear.values()).sort((a, b) => String(a.year).localeCompare(String(b.year)));
  }, [selectedCodes, seriesByCode]);

  // Curvas IDF comparadas: fila por duración, una columna de intensidad por
  // estación (para el período de retorno elegido).
  const idfChartData = useMemo(() => {
    const byDur = new Map<number, Record<string, number>>();
    for (const code of selectedCodes) {
      const curve = idfByCode[code]?.curves.find((c) => c.returnPeriod === idfTr);
      for (const point of curve?.points || []) {
        if (!(point.intensityMmH > 0)) continue; // eje log: descartar ≤0 (aud. #5 #10)
        const row = byDur.get(point.durMin) || { durMin: point.durMin };
        row[code] = point.intensityMmH;
        byDur.set(point.durMin, row);
      }
    }
    return Array.from(byDur.values()).sort((a, b) => a.durMin - b.durMin);
  }, [selectedCodes, idfByCode, idfTr]);

  const hasIdf = datasetId === PRECIP_DATASET && idfChartData.length > 0;
  const idfReturnPeriods = useMemo(() => {
    for (const code of selectedCodes) {
      const rp = idfByCode[code]?.returnPeriods;
      if (rp?.length) return rp;
    }
    return [2, 5, 10, 25, 50, 100];
  }, [selectedCodes, idfByCode]);

  const stationLabel = (code: string) => {
    const found = catalog.find((s) => s.codigo === code);
    return found ? `${found.nombre} (${code.slice(-4)})` : code;
  };

  const addStation = (code: string) => {
    setSelectedCodes((current) => (current.includes(code) || current.length >= MAX_STATIONS ? current : [...current, code]));
    setQuery('');
  };

  const datasetName = datasets.find((d) => d.id === datasetId)?.name || '';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-card-foreground text-2xl font-bold">Comparador de estaciones</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Superpone las series históricas (y las curvas IDF, en precipitación) de hasta {MAX_STATIONS} estaciones.
          También puedes añadirlas desde el popup del mapa.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 shadow-[0_0_20px] shadow-accent/10">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-xs text-muted-foreground">
            <span className="font-semibold uppercase tracking-wide">Variable</span>
            <select
              value={datasetId}
              onChange={(event) => setDatasetId(event.target.value)}
              className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-card-foreground outline-none focus:border-accent"
            >
              {(datasets.length ? datasets : [{ id: 's54a-sgyg', name: 'Precipitacion' }]).map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </label>
          <div className="relative flex flex-col gap-1.5 text-xs text-muted-foreground">
            <span className="font-semibold uppercase tracking-wide">Buscar estación (nombre, código o municipio)</span>
            <div className="flex h-10 items-center gap-2 rounded-lg border border-border bg-background px-3 focus-within:border-accent">
              <Search className="h-4 w-4 shrink-0" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={selectedCodes.length >= MAX_STATIONS ? `Máximo ${MAX_STATIONS} estaciones` : 'Ej: APTO ERNESTO CORTISSOZ o 2904'}
                disabled={selectedCodes.length >= MAX_STATIONS}
                className="w-full bg-transparent text-sm text-card-foreground outline-none disabled:opacity-50"
              />
            </div>
            {suggestions.length > 0 && (
              <div className="absolute top-[64px] z-20 w-full overflow-hidden rounded-lg border border-border bg-card shadow-2xl">
                {suggestions.map((s) => (
                  <button
                    key={s.codigo}
                    type="button"
                    onClick={() => addStation(s.codigo)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-card-foreground transition-colors hover:bg-accent/10"
                  >
                    <Plus className="h-3.5 w-3.5 shrink-0 text-accent" />
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{s.nombre}</span>
                      <span className="block truncate text-xs text-muted-foreground">{s.codigo} · {s.municipio}, {s.departamento}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {selectedCodes.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {selectedCodes.map((code, index) => (
              <span
                key={code}
                className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold"
                style={{ borderColor: SERIES_COLORS[index], color: SERIES_COLORS[index] }}
              >
                {stationLabel(code)}
                <button
                  type="button"
                  onClick={() => setSelectedCodes((current) => current.filter((c) => c !== code))}
                  aria-label={`Quitar ${code} de la comparación`}
                  className="rounded-full p-0.5 transition-colors hover:bg-destructive/20"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>
      )}

      {selectedCodes.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center text-muted-foreground">
          <GitCompareArrows className="mx-auto mb-3 h-8 w-8 text-accent" />
          <p className="font-semibold text-card-foreground">Elige estaciones para comparar</p>
          <p className="mt-1 text-sm">Usa el buscador o haz clic en una estación del mapa y pulsa "Añadir al comparador".</p>
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-border bg-card p-6 shadow-glow">
            <div className="mb-6 flex items-center justify-between gap-4">
              <h3 className="font-bold text-card-foreground">Promedio anual de {datasetName}{unitSuffix(datasetUnit(datasetId))} · series superpuestas</h3>
              {!isLoading && chartData.length > 0 && (
                <ChartDownloadButton
                  targetRef={chartRef}
                  title={`Comparador · ${datasetName}`}
                  subtitle={`${selectedCodes.length} estaciones`}
                  filenameParts={['comparador', datasetName]}
                />
              )}
            </div>
            {isLoading ? (
              <SkeletonLoader rows={4} />
            ) : chartData.length === 0 ? (
              <p className="text-muted-foreground text-sm">Ninguna de las estaciones elegidas tiene datos de {datasetName}.</p>
            ) : (
              <div ref={chartRef} className="bg-card" style={{ width: '100%', height: '320px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border" />
                    <XAxis dataKey="year" stroke="currentColor" className="text-muted-foreground" style={{ fontSize: '12px' }} minTickGap={24} />
                    <YAxis stroke="currentColor" className="text-muted-foreground" style={{ fontSize: '12px' }} tickFormatter={(v: number) => formatValue(v)} width={70} />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'var(--background)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--foreground)' }}
                      formatter={(value: number, name: string) => [`${formatValue(value)}${unitSuffix(datasetUnit(datasetId))}`, stationLabel(name)]}
                    />
                    <Legend formatter={(value: string) => stationLabel(value)} />
                    {selectedCodes.map((code, index) => (
                      <Line
                        key={code}
                        type="monotone"
                        dataKey={code}
                        stroke={SERIES_COLORS[index]}
                        strokeWidth={2}
                        dot={false}
                        connectNulls
                        isAnimationActive animationDuration={550}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {datasetId === PRECIP_DATASET && (
            <div className="rounded-xl border border-border bg-card p-6 shadow-glow">
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="font-bold text-card-foreground">Curvas IDF comparadas</h3>
                  <p className="text-sm text-muted-foreground">Intensidad (mm/h) vs duración para Tr = {idfTr} años · solo estaciones pluviográficas</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {hasIdf && (
                    <ChartDownloadButton
                      targetRef={idfChartRef}
                      title="Curvas IDF comparadas"
                      subtitle={`Tr = ${idfTr} años`}
                      filenameParts={['idf-comparadas', `tr-${idfTr}a`]}
                    />
                  )}
                  <div className="flex gap-1">
                    {idfReturnPeriods.map((tr) => (
                      <button
                        key={tr}
                        type="button"
                        onClick={() => setIdfTr(tr)}
                        aria-pressed={idfTr === tr}
                        className={`rounded-md border px-2 py-1 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                          idfTr === tr ? 'border-accent bg-accent/15 text-accent' : 'border-border text-muted-foreground'
                        }`}
                      >
                        {tr}a
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              {isLoading ? (
                <SkeletonLoader rows={4} />
              ) : !hasIdf ? (
                <p className="text-muted-foreground text-sm">
                  Ninguna de las estaciones elegidas tiene curvas IDF precomputadas todavía (deben ser pluviográficas).
                </p>
              ) : (
                <div ref={idfChartRef} className="bg-card" style={{ width: '100%', height: '300px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={idfChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border" />
                      <XAxis
                        dataKey="durMin"
                        type="number"
                        scale="log"
                        domain={['dataMin', 'dataMax']}
                        ticks={[10, 20, 30, 60, 120, 180, 360, 720, 1440]}
                        stroke="currentColor"
                        className="text-muted-foreground"
                        style={{ fontSize: '11px' }}
                        label={{ value: 'Duración (min, log)', position: 'insideBottom', offset: -2, fontSize: 10 }}
                      />
                      <YAxis scale="log" domain={['auto', 'auto']} stroke="currentColor" className="text-muted-foreground" style={{ fontSize: '11px' }} width={52} label={{ value: 'mm/h', angle: -90, position: 'insideLeft', fontSize: 10 }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: 'var(--background)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--foreground)' }}
                        formatter={(value: number, name: string) => [`${value} mm/h`, stationLabel(name)]}
                        labelFormatter={(v) => `Duración ${v} min`}
                      />
                      <Legend formatter={(value: string) => stationLabel(value)} />
                      {selectedCodes.map((code, index) => (
                        <Line key={code} type="monotone" dataKey={code} stroke={SERIES_COLORS[index]} strokeWidth={2} dot={{ r: 2 }} connectNulls isAnimationActive animationDuration={550} />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          <div className="rounded-xl border border-border bg-card p-6 shadow-glow">
            <h3 className="mb-4 font-bold text-card-foreground">Estadísticos comparados</h3>
            {isLoading ? (
              <SkeletonLoader rows={3} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="py-2 pr-3 font-semibold">Estación</th>
                      <th className="py-2 pr-3 font-semibold">Ubicación</th>
                      <th className="py-2 pr-3 text-right font-semibold">Observaciones</th>
                      <th className="py-2 pr-3 text-right font-semibold">Media</th>
                      <th className="py-2 text-right font-semibold">Período</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedCodes.map((code, index) => {
                      const row = stationStats.find((s) => s.code === code);
                      return (
                        <tr key={code} className="border-b border-border/60">
                          <td className="py-2.5 pr-3 font-semibold" style={{ color: SERIES_COLORS[index] }}>{stationLabel(code)}</td>
                          <td className="py-2.5 pr-3 text-muted-foreground">{row ? `${row.municipality || 'N/D'}, ${row.department || 'N/D'}` : '—'}</td>
                          <td className="py-2.5 pr-3 text-right font-mono text-card-foreground">{row ? row.rowCount.toLocaleString('es-CO') : 'sin datos'}</td>
                          <td className="py-2.5 pr-3 text-right font-mono text-card-foreground">{formatValue(row?.mean)}</td>
                          <td className="py-2.5 text-right text-muted-foreground">
                            {row?.firstObservation && row?.lastObservation
                              ? `${row.firstObservation.slice(0, 4)} – ${row.lastObservation.slice(0, 7)}`
                              : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

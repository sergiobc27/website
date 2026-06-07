import { useEffect, useMemo, useState } from 'react';
import { Building2, Check, Link2, MapPin, CalendarRange, Database } from 'lucide-react';
import { Area, AreaChart, Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { SkeletonLoader } from './SkeletonLoader';
import { apiJson } from '../lib/ideamApi';
import { datasetUnit, unitSuffix } from '../lib/units';
import type {
  AnalyticsByStationResponse,
  AnalyticsClimatologyResponse,
  AnalyticsTimeseriesResponse,
  MetaResponse,
} from '../../shared/ideamContracts';

const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function formatValue(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  if (abs >= 100) return value.toLocaleString('es-CO', { maximumFractionDigits: 1 });
  if (abs >= 1) return value.toLocaleString('es-CO', { maximumFractionDigits: 2 });
  return value.toLocaleString('es-CO', { maximumFractionDigits: 4 });
}

export function fichaHash(department: string, municipality: string) {
  return `#/ficha/${encodeURIComponent(department)}/${encodeURIComponent(municipality)}`;
}

export function FichaClimatica({ initialDepartment = '', initialMunicipality = '' }: { initialDepartment?: string; initialMunicipality?: string }) {
  const [datasets, setDatasets] = useState<Array<{ id: string; name: string }>>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [datasetId, setDatasetId] = useState('s54a-sgyg');
  const [department, setDepartment] = useState(initialDepartment);
  const [municipalities, setMunicipalities] = useState<string[]>([]);
  const [municipality, setMunicipality] = useState(initialMunicipality);

  const [climatology, setClimatology] = useState<AnalyticsClimatologyResponse | null>(null);
  const [yearly, setYearly] = useState<AnalyticsTimeseriesResponse | null>(null);
  const [stations, setStations] = useState<AnalyticsByStationResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiJson<MetaResponse>('/api/meta', undefined, 'No fue posible cargar la metadata.')
      .then((meta) => {
        if (cancelled) return;
        setDatasets(meta.datasets.map((d) => ({ id: d.id, name: d.name })));
        setDepartments(meta.departments);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  // Municipios del departamento elegido (GET cacheado 1h en el borde).
  useEffect(() => {
    if (!department) {
      setMunicipalities([]);
      return;
    }
    let cancelled = false;
    apiJson<{ municipalities: string[] }>(
      `/api/municipalities?department=${encodeURIComponent(department)}`,
      undefined,
      'No fue posible cargar los municipios.'
    )
      .then((data) => {
        if (cancelled) return;
        setMunicipalities(data.municipalities || []);
        setMunicipality((current) => (current && data.municipalities?.includes(current) ? current : ''));
      })
      .catch(() => {
        if (!cancelled) setMunicipalities([]);
      });
    return () => {
      cancelled = true;
    };
  }, [department]);

  // La ficha es compartible: la selección viaja en el hash de la URL.
  useEffect(() => {
    if (department && municipality) {
      window.history.replaceState(null, '', fichaHash(department, municipality));
    }
  }, [department, municipality]);

  useEffect(() => {
    if (!department || !municipality) {
      setClimatology(null);
      setYearly(null);
      setStations(null);
      return;
    }
    const controller = new AbortController();
    const scope = {
      datasetId,
      departments: [department],
      catalogFilters: { municipalities: [municipality] },
    };
    const post = (body: object) => ({
      method: 'POST' as const,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const load = async () => {
      setIsLoading(true);
      setError('');
      try {
        const [clim, serie, byStation] = await Promise.all([
          apiJson<AnalyticsClimatologyResponse>('/api/analytics/monthly-climatology', post(scope), 'Sin climatología.'),
          apiJson<AnalyticsTimeseriesResponse>('/api/analytics/timeseries', post({ ...scope, interval: 'year', metric: 'avg' }), 'Sin serie.'),
          apiJson<AnalyticsByStationResponse>('/api/analytics/by-station', post(scope), 'Sin estaciones.'),
        ]);
        if (controller.signal.aborted) return;
        setClimatology(clim);
        setYearly(serie);
        setStations(byStation);
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : 'No fue posible cargar la ficha.');
        }
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    };
    void load();
    return () => controller.abort();
  }, [datasetId, department, municipality]);

  const totals = useMemo(() => {
    const rows = stations?.stations || [];
    return {
      stations: rows.length,
      observations: rows.reduce((sum, s) => sum + s.rowCount, 0),
      first: rows.reduce<string | null>((min, s) => (s.firstObservation && (!min || s.firstObservation < min) ? s.firstObservation : min), null),
      last: rows.reduce<string | null>((max, s) => (s.lastObservation && (!max || s.lastObservation > max) ? s.lastObservation : max), null),
    };
  }, [stations]);

  const climatologyData = useMemo(
    () => (climatology?.months || []).map((m) => ({ label: MONTH_NAMES[m.month - 1], media: m.mean, máximo: m.max, mínimo: m.min })),
    [climatology]
  );
  const yearlyData = useMemo(
    () =>
      (yearly?.points || [])
        .filter((p) => p.value !== null)
        .map((p) => ({ year: p.bucket.slice(0, 4), valor: p.value })),
    [yearly]
  );

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/${fichaHash(department, municipality)}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // El portapapeles puede estar bloqueado; el hash ya está en la barra.
    }
  };

  const datasetName = datasets.find((d) => d.id === datasetId)?.name || '';
  const unidad = datasetUnit(datasetId);
  const tooltipStyle = { backgroundColor: 'var(--background)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--foreground)' };
  const ready = department && municipality;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-card-foreground text-2xl font-bold">
            {ready ? `Ficha climática · ${municipality}, ${department}` : 'Ficha climática municipal'}
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            El resumen hidroclimático de cualquier municipio del país, listo para compartir.
          </p>
        </div>
        {ready && (
          <button
            type="button"
            onClick={copyLink}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-accent/40 bg-accent/10 px-3 text-sm font-semibold text-accent transition-colors hover:bg-accent/20"
          >
            {copied ? <Check className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
            {copied ? 'Enlace copiado' : 'Copiar enlace'}
          </button>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-4 shadow-[0_0_20px] shadow-accent/10">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="flex flex-col gap-1.5 text-xs text-muted-foreground">
            <span className="font-semibold uppercase tracking-wide">Departamento</span>
            <select
              value={department}
              onChange={(event) => setDepartment(event.target.value)}
              className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-card-foreground outline-none focus:border-accent"
            >
              <option value="">Selecciona...</option>
              {departments.map((dep) => (
                <option key={dep} value={dep}>{dep}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-xs text-muted-foreground">
            <span className="font-semibold uppercase tracking-wide">Municipio</span>
            <select
              value={municipality}
              onChange={(event) => setMunicipality(event.target.value)}
              disabled={!municipalities.length}
              className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-card-foreground outline-none focus:border-accent disabled:opacity-50"
            >
              <option value="">{department ? 'Selecciona...' : 'Elige primero el departamento'}</option>
              {municipalities.map((mun) => (
                <option key={mun} value={mun}>{mun}</option>
              ))}
            </select>
          </label>
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
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>
      )}

      {!ready ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center text-muted-foreground">
          <Building2 className="mx-auto mb-3 h-8 w-8 text-accent" />
          <p className="font-semibold text-card-foreground">Elige un departamento y un municipio</p>
          <p className="mt-1 text-sm">La ficha reúne climatología, tendencia anual y estaciones con un enlace compartible.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            <FichaStat icon={MapPin} title="Estaciones con datos" value={isLoading ? '…' : String(totals.stations)} />
            <FichaStat icon={Database} title={`Observaciones de ${datasetName}`} value={isLoading ? '…' : totals.observations.toLocaleString('es-CO')} />
            <FichaStat icon={CalendarRange} title="Período cubierto" value={isLoading ? '…' : totals.first && totals.last ? `${totals.first.slice(0, 4)} – ${totals.last.slice(0, 7)}` : 'Sin datos'} />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-6 shadow-[0_0_40px_rgba(201,162,39,0.1)]">
              <h3 className="mb-6 font-bold text-card-foreground">Climatología mensual{unitSuffix(unidad)}</h3>
              {isLoading ? (
                <SkeletonLoader rows={4} />
              ) : climatologyData.every((m) => m.media === null) ? (
                <p className="text-muted-foreground text-sm">Sin datos de {datasetName} en este municipio.</p>
              ) : (
                <div style={{ width: '100%', height: '260px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={climatologyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border" />
                      <XAxis dataKey="label" stroke="currentColor" className="text-muted-foreground" style={{ fontSize: '12px' }} />
                      <YAxis stroke="currentColor" className="text-muted-foreground" style={{ fontSize: '12px' }} tickFormatter={(v: number) => formatValue(v)} width={64} />
                      <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => formatValue(value)} />
                      <Bar dataKey="media" fill="var(--accent)" radius={[6, 6, 0, 0]} isAnimationActive={false} />
                      <Line type="monotone" dataKey="máximo" stroke="var(--primary)" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                      <Line type="monotone" dataKey="mínimo" stroke="currentColor" className="text-muted-foreground" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-border bg-card p-6 shadow-[0_0_40px_rgba(201,162,39,0.1)]">
              <h3 className="mb-6 font-bold text-card-foreground">Promedio anual{unitSuffix(unidad)}</h3>
              {isLoading ? (
                <SkeletonLoader rows={4} />
              ) : yearlyData.length === 0 ? (
                <p className="text-muted-foreground text-sm">Sin datos de {datasetName} en este municipio.</p>
              ) : (
                <div style={{ width: '100%', height: '260px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={yearlyData}>
                      <defs>
                        <linearGradient id="fichaGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.45} />
                          <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.05} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border" />
                      <XAxis dataKey="year" stroke="currentColor" className="text-muted-foreground" style={{ fontSize: '12px' }} minTickGap={24} />
                      <YAxis stroke="currentColor" className="text-muted-foreground" style={{ fontSize: '12px' }} tickFormatter={(v: number) => formatValue(v)} width={64} />
                      <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [formatValue(value), 'Promedio']} />
                      <Area type="monotone" dataKey="valor" stroke="var(--accent)" strokeWidth={2} fill="url(#fichaGradient)" isAnimationActive={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-6 shadow-[0_0_40px_rgba(201,162,39,0.1)]">
            <h3 className="mb-4 font-bold text-card-foreground">Estaciones del municipio</h3>
            {isLoading ? (
              <SkeletonLoader rows={3} />
            ) : !stations?.stations.length ? (
              <p className="text-muted-foreground text-sm">Sin estaciones con datos de {datasetName}.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="py-2 pr-3 font-semibold">Código</th>
                      <th className="py-2 pr-3 text-right font-semibold">Observaciones</th>
                      <th className="py-2 pr-3 text-right font-semibold">Media</th>
                      <th className="py-2 text-right font-semibold">Período</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stations.stations.slice(0, 15).map((s) => (
                      <tr key={s.code} className="border-b border-border/60">
                        <td className="py-2.5 pr-3 font-mono text-card-foreground">{s.code}</td>
                        <td className="py-2.5 pr-3 text-right font-mono text-card-foreground">{s.rowCount.toLocaleString('es-CO')}</td>
                        <td className="py-2.5 pr-3 text-right font-mono text-card-foreground">{formatValue(s.mean)}</td>
                        <td className="py-2.5 text-right text-muted-foreground">
                          {s.firstObservation && s.lastObservation ? `${s.firstObservation.slice(0, 4)} – ${s.lastObservation.slice(0, 7)}` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            Fuente: IDEAM vía datos abiertos de Colombia (datos.gov.co), espejo propio sincronizado dos veces al día. Esta ficha
            es informativa; para decisiones de diseño consulta los datos crudos (pestaña Extractor) y la fuente oficial.
          </p>
        </>
      )}
    </div>
  );
}

function FichaStat({ icon: Icon, title, value }: { icon: React.ElementType; title: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-[0_0_20px] shadow-accent/10">
      <Icon className="mb-3 h-6 w-6 text-accent" />
      <p className="text-sm text-muted-foreground">{title}</p>
      <p className="mt-1 font-mono text-2xl font-bold text-card-foreground break-words">{value}</p>
    </div>
  );
}

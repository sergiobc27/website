import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BarChart4, CheckCircle2, CloudRain, Droplets, Plus, Search, Waves } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { SkeletonLoader } from './SkeletonLoader';
import { CalculadoraCaudal } from './CalculadoraCaudal';
import { apiJson, apiUrl } from '../lib/ideamApi';
import type {
  AnalyticsTimeseriesResponse,
  HistogramResponse,
  IdfResponse,
  ReturnPeriodsResponse,
  SpiResponse,
} from '../../shared/ideamContracts';

const IDF_COLORS = ['#60a5fa', '#34d399', '#C9A227', '#f59e0b', '#A3161A', '#7f1d1d'];

const PRECIP_DATASET = 's54a-sgyg';
const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

interface StationLite {
  codigo: string;
  nombre: string;
  municipio: string;
  departamento: string;
}

function spiColor(z: number | null) {
  if (z === null) return '#3f3f46'; // no calculable (<3 años de historia)
  if (z <= -2) return '#7f1d1d';
  if (z <= -1.5) return '#A3161A';
  if (z <= -1) return '#dc7633';
  if (z < 1) return '#9ca3af';
  if (z < 1.5) return '#60a5fa';
  if (z < 2) return '#2563eb';
  return '#1e3a8a';
}

const tooltipStyle = {
  backgroundColor: 'var(--background)',
  border: '1px solid var(--border)',
  borderRadius: '8px',
  color: 'var(--foreground)',
};

export function Hidrologia() {
  const [catalog, setCatalog] = useState<StationLite[]>([]);
  const [query, setQuery] = useState('');
  const [station, setStation] = useState<StationLite | null>(null);

  const [returnPeriods, setReturnPeriods] = useState<ReturnPeriodsResponse | null>(null);
  const [spi, setSpi] = useState<SpiResponse | null>(null);
  const [spiScale, setSpiScale] = useState<3 | 6 | 12>(12);
  const [histogramData, setHistogramData] = useState<HistogramResponse | null>(null);
  const [idf, setIdf] = useState<IdfResponse | null>(null);
  const [hyetographYear, setHyetographYear] = useState('');
  const [hyetograph, setHyetograph] = useState<AnalyticsTimeseriesResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetch(apiUrl('/api/stations.geojson'), { headers: { accept: 'application/json' } })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error('catálogo'))))
      .then((geo: { features: Array<{ properties: { codigo: string; nombre: string | null; municipio: string | null; departamento: string | null } }> }) => {
        if (cancelled) return;
        setCatalog(
          geo.features.map((f) => ({
            codigo: f.properties.codigo,
            nombre: f.properties.nombre || f.properties.codigo,
            municipio: f.properties.municipio || 'N/D',
            departamento: f.properties.departamento || 'N/D',
          }))
        );
      })
      .catch(() => setError('No fue posible cargar el catálogo de estaciones.'));
    return () => {
      cancelled = true;
    };
  }, []);

  const suggestions = useMemo(() => {
    const q = query.trim().toUpperCase();
    if (q.length < 2) return [];
    return catalog
      .filter((s) => s.codigo.includes(q) || s.nombre.toUpperCase().includes(q) || s.municipio.toUpperCase().includes(q))
      .slice(0, 8);
  }, [catalog, query]);

  const scopeFor = (code: string) => ({
    datasetId: PRECIP_DATASET,
    departments: [] as string[],
    catalogFilters: { stations: [code] },
  });
  const post = (body: object, signal: AbortSignal) => ({
    method: 'POST' as const,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });

  // Períodos de retorno + histograma (dependen solo de la estación).
  useEffect(() => {
    if (!station) return;
    const controller = new AbortController();
    const load = async () => {
      setIsLoading(true);
      setError('');
      try {
        const [rp, hist, idfData] = await Promise.all([
          apiJson<ReturnPeriodsResponse>('/api/analytics/return-periods', post(scopeFor(station.codigo), controller.signal), 'Sin períodos de retorno.'),
          apiJson<HistogramResponse>('/api/analytics/histogram', post(scopeFor(station.codigo), controller.signal), 'Sin histograma.'),
          apiJson<IdfResponse>('/api/analytics/idf', post(scopeFor(station.codigo), controller.signal), 'Sin IDF.'),
        ]);
        if (controller.signal.aborted) return;
        setReturnPeriods(rp);
        setHistogramData(hist);
        setIdf(idfData);
        const lastYear = rp.stationYears.at(-1)?.year;
        setHyetographYear((current) => current || (lastYear ? String(lastYear) : ''));
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'No fue posible cargar el análisis.');
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    };
    void load();
    return () => controller.abort();
  }, [station?.codigo]);

  // SPI (estación + escala).
  useEffect(() => {
    if (!station) return;
    const controller = new AbortController();
    apiJson<SpiResponse>('/api/analytics/spi', post({ ...scopeFor(station.codigo), scale: spiScale }, controller.signal), 'Sin SPI.')
      .then((data) => {
        if (!controller.signal.aborted) setSpi(data);
      })
      .catch(() => {
        if (!controller.signal.aborted) setSpi(null);
      });
    return () => controller.abort();
  }, [station?.codigo, spiScale]);

  // Hietograma mensual del año elegido.
  useEffect(() => {
    if (!station || !hyetographYear) return;
    const controller = new AbortController();
    apiJson<AnalyticsTimeseriesResponse>(
      '/api/analytics/timeseries',
      post(
        {
          ...scopeFor(station.codigo),
          interval: 'month',
          metric: 'sum',
          startDate: `${hyetographYear}-01-01`,
          endDate: `${hyetographYear}-12-31`,
        },
        controller.signal
      ),
      'Sin hietograma.'
    )
      .then((data) => {
        if (!controller.signal.aborted) setHyetograph(data);
      })
      .catch(() => {
        if (!controller.signal.aborted) setHyetograph(null);
      });
    return () => controller.abort();
  }, [station?.codigo, hyetographYear]);

  const returnCurve = useMemo(() => {
    if (!returnPeriods?.gumbel) return [];
    const fitted = returnPeriods.quantiles.map((q) => ({ tr: q.returnPeriod, ajustado: q.value }));
    const observed = returnPeriods.empirical
      .filter((e) => e.returnPeriod >= 1.05)
      .map((e) => ({ tr: e.returnPeriod, observado: e.value }));
    return [...fitted, ...observed].sort((a, b) => a.tr - b.tr);
  }, [returnPeriods]);

  const spiData = useMemo(
    // Los meses no calculables (spi=null) se omiten del gráfico de barras.
    () => (spi?.points || []).slice(-120).filter((p) => p.spi !== null).map((p) => ({ ...p, label: p.month })),
    [spi]
  );

  const hyetographData = useMemo(
    () =>
      (hyetograph?.points || []).map((p) => ({
        label: MONTH_NAMES[Number(p.bucket.slice(5, 7)) - 1] || p.bucket,
        total: p.value,
      })),
    [hyetograph]
  );

  const histogramBins = useMemo(
    () =>
      (histogramData?.bins || [])
        .filter((b) => b.count > 0 || b.from < (histogramData?.maxDaily || 0) * 0.75)
        .map((b) => ({ label: `${b.from}-${b.to}`, dias: b.count })),
    [histogramData]
  );

  const years = useMemo(() => (returnPeriods?.stationYears || []).map((y) => String(y.year)), [returnPeriods]);

  // Curvas IDF: fila por duración, una columna de intensidad por período de
  // retorno (formato que Recharts grafica como familia de líneas).
  const idfChartData = useMemo(() => {
    if (!idf?.available) return [];
    const byDur = new Map<number, Record<string, number>>();
    for (const curve of idf.curves) {
      for (const point of curve.points) {
        // El eje Y es logarítmico: una intensidad ≤0 daría log(0)=−∞ y rompería
        // TODA la familia de curvas sin error visible (auditoría #5 #10).
        if (!(point.intensityMmH > 0)) continue;
        const row = byDur.get(point.durMin) || { durMin: point.durMin };
        row[`tr${curve.returnPeriod}`] = point.intensityMmH;
        byDur.set(point.durMin, row);
      }
    }
    return Array.from(byDur.values()).sort((a, b) => a.durMin - b.durMin);
  }, [idf]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-card-foreground text-2xl font-bold">Hidrología de precipitación</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Períodos de retorno (Gumbel), monitor de sequía (SPI), hietograma e histograma por estación.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 shadow-[0_0_20px] shadow-accent/10">
        <div className="relative flex flex-col gap-1.5 text-xs text-muted-foreground">
          <span className="font-semibold uppercase tracking-wide">Estación (nombre, código o municipio)</span>
          <div className="flex h-10 items-center gap-2 rounded-lg border border-border bg-background px-3 focus-within:border-accent">
            <Search className="h-4 w-4 shrink-0" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={station ? `${station.nombre} · ${station.municipio}` : 'Ej: 0029004520 o VILLAVICENCIO'}
              className="w-full bg-transparent text-sm text-card-foreground outline-none"
            />
          </div>
          {suggestions.length > 0 && (
            <div className="absolute top-[64px] z-20 w-full overflow-hidden rounded-lg border border-border bg-card shadow-2xl">
              {suggestions.map((s) => (
                <button
                  key={s.codigo}
                  type="button"
                  onClick={() => {
                    setStation(s);
                    setQuery('');
                    setHyetographYear('');
                  }}
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

      {error && (
        <div role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>
      )}

      {!station ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center text-muted-foreground">
          <Droplets className="mx-auto mb-3 h-8 w-8 text-accent" />
          <p className="font-semibold text-card-foreground">Elige una estación pluviométrica</p>
          <p className="mt-1 text-sm">Los cuatro análisis se calculan sobre su registro completo en el espejo.</p>
        </div>
      ) : (
        <>
          {(returnPeriods?.warnings || []).length > 0 && (
            <div className="flex items-start gap-2 rounded-xl border border-accent/40 bg-accent/10 px-4 py-3 text-sm text-accent">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>{returnPeriods?.warnings.map((w) => <p key={w}>{w}</p>)}</div>
            </div>
          )}

          {/* CURVAS IDF — pieza estrella, ancho completo */}
          <div className="rounded-xl border border-border bg-card p-6 shadow-[0_0_40px_rgba(201,162,39,0.1)]">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <h3 className="font-bold text-card-foreground">Curvas IDF · Intensidad–Duración–Frecuencia</h3>
                <p className="text-sm text-muted-foreground">
                  {idf?.available
                    ? `Intensidad (mm/h) vs duración, una curva por período de retorno · ${idf.nYears} años, datos de 10 min`
                    : 'Familia de curvas de diseño de drenaje'}
                </p>
              </div>
              <CloudRain className="h-5 w-5 shrink-0 text-accent" />
            </div>
            {isLoading ? (
              <SkeletonLoader rows={5} />
            ) : !idf?.available ? (
              <p className="text-muted-foreground text-sm">
                {idf?.message || 'Esta estación no tiene curvas IDF disponibles todavía.'}
              </p>
            ) : (
              <div className="space-y-4">
                <div style={{ width: '100%', height: '320px' }}>
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
                        label={{ value: 'Duración (min, escala log)', position: 'insideBottom', offset: -2, fontSize: 10 }}
                      />
                      <YAxis
                        scale="log"
                        domain={['auto', 'auto']}
                        stroke="currentColor"
                        className="text-muted-foreground"
                        style={{ fontSize: '11px' }}
                        width={52}
                        label={{ value: 'mm/h', angle: -90, position: 'insideLeft', fontSize: 10 }}
                      />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        formatter={(value: number, name: string) => [`${value} mm/h`, name.replace('tr', 'Tr ') + ' años']}
                        labelFormatter={(v) => `Duración ${v} min`}
                      />
                      <Legend formatter={(value: string) => `Tr ${value.replace('tr', '')} años`} />
                      {(idf.returnPeriods || []).map((tr, index) => (
                        <Line
                          key={tr}
                          type="monotone"
                          dataKey={`tr${tr}`}
                          stroke={IDF_COLORS[index % IDF_COLORS.length]}
                          strokeWidth={2}
                          dot={{ r: 2 }}
                          connectNulls
                          isAnimationActive={false}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {idf.equation && (
                  <div className="rounded-lg border border-accent/30 bg-accent/5 px-4 py-3 text-sm">
                    <span className="text-muted-foreground">Ecuación ajustada: </span>
                    <span className="font-mono font-semibold text-card-foreground">
                      I = {idf.equation.K} · T<sup>{idf.equation.m}</sup> / D<sup>{idf.equation.n}</sup>
                    </span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      (I en mm/h, T en años, D en min · R²<sub>log</sub> = {idf.equation.r2})
                    </span>
                  </div>
                )}

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="py-2 pr-3 font-semibold">Dur. (min)</th>
                        {(idf.returnPeriods || []).map((tr) => (
                          <th key={tr} className="py-2 pr-3 text-right font-semibold">Tr {tr}a</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {idfChartData.map((row) => (
                        <tr key={row.durMin} className="border-b border-border/60">
                          <td className="py-2 pr-3 font-mono text-card-foreground">{row.durMin}</td>
                          {(idf.returnPeriods || []).map((tr) => (
                            <td key={tr} className="py-2 pr-3 text-right font-mono text-card-foreground">
                              {row[`tr${tr}`] != null ? `${row[`tr${tr}`]}` : '—'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="mt-1 text-xs text-muted-foreground">Intensidades en mm/h.</p>
                </div>

                {(idf.warnings || []).map((w) => (
                  <div key={w} className="flex items-start gap-2 text-xs text-accent">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>{w}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {idf?.available && idf.equation && (
            <CalculadoraCaudal equation={idf.equation} durations={idf.durations} />
          )}

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-6 shadow-[0_0_40px_rgba(201,162,39,0.1)]">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <h3 className="font-bold text-card-foreground">Períodos de retorno · lluvia máxima diaria</h3>
                  <p className="text-sm text-muted-foreground">Gumbel (método de momentos) sobre {returnPeriods?.n ?? 0} máximos anuales</p>
                </div>
                <Waves className="h-5 w-5 shrink-0 text-accent" />
              </div>
              {isLoading ? (
                <SkeletonLoader rows={4} />
              ) : !returnPeriods?.gumbel ? (
                <p className="text-muted-foreground text-sm">Registro insuficiente para ajustar (mínimo 5 años válidos).</p>
              ) : (
                <>
                  {returnPeriods.goodnessOfFit && (
                    <div
                      className={`mb-4 flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${
                        returnPeriods.goodnessOfFit.passes
                          ? 'border-success/40 bg-success/10 text-success'
                          : 'border-accent/40 bg-accent/10 text-accent'
                      }`}
                    >
                      {returnPeriods.goodnessOfFit.passes ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
                      <span>
                        <strong>Bondad de ajuste (Kolmogorov-Smirnov):</strong>{' '}
                        {returnPeriods.goodnessOfFit.passes
                          ? 'el ajuste Gumbel es aceptable'
                          : 'el ajuste Gumbel NO pasa el test; usa los cuantiles con cautela'}{' '}
                        — D = {returnPeriods.goodnessOfFit.statistic} {returnPeriods.goodnessOfFit.passes ? '<' : '≥'} {returnPeriods.goodnessOfFit.critical} (crítico, α = {returnPeriods.goodnessOfFit.alpha}). Exigido por el Manual de Drenaje INVÍAS.
                      </span>
                    </div>
                  )}
                  <div className="mb-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
                    {returnPeriods.quantiles.map((q) => (
                      <div key={q.returnPeriod} className="rounded-lg border border-border bg-background p-2 text-center">
                        <p className="text-xs text-muted-foreground">Tr {q.returnPeriod} años</p>
                        <p className="font-mono text-sm font-bold text-card-foreground">{q.value}</p>
                        <p className="text-[10px] text-muted-foreground">mm/día</p>
                      </div>
                    ))}
                  </div>
                  <div style={{ width: '100%', height: '220px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={returnCurve}>
                        <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border" />
                        <XAxis
                          dataKey="tr"
                          type="number"
                          scale="log"
                          domain={[1, 120]}
                          ticks={[2, 5, 10, 25, 50, 100]}
                          stroke="currentColor"
                          className="text-muted-foreground"
                          style={{ fontSize: '11px' }}
                          label={{ value: 'Período de retorno (años, escala log)', position: 'insideBottom', offset: -2, fontSize: 10 }}
                        />
                        <YAxis stroke="currentColor" className="text-muted-foreground" style={{ fontSize: '11px' }} width={48} />
                        <Tooltip contentStyle={tooltipStyle} formatter={(value: number, name: string) => [`${value} mm/día`, name]} labelFormatter={(v) => `Tr ≈ ${v} años`} />
                        <Line type="monotone" dataKey="ajustado" name="Gumbel ajustado" stroke="#C9A227" strokeWidth={2} dot={{ r: 3 }} connectNulls isAnimationActive={false} />
                        <Scatter dataKey="observado" name="Observado (Weibull)" fill="#A3161A" isAnimationActive={false} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </>
              )}
            </div>

            <div className="rounded-xl border border-border bg-card p-6 shadow-[0_0_40px_rgba(201,162,39,0.1)]">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <h3 className="font-bold text-card-foreground">Monitor de sequía · SPI-{spiScale}</h3>
                  <p className="text-sm text-muted-foreground">Índice de Precipitación Estandarizada (últimos 10 años)</p>
                </div>
                <div className="flex gap-1">
                  {([3, 6, 12] as const).map((scale) => (
                    <button
                      key={scale}
                      type="button"
                      onClick={() => setSpiScale(scale)}
                      aria-pressed={spiScale === scale}
                      className={`rounded-md border px-2 py-1 text-xs font-semibold ${
                        spiScale === scale ? 'border-accent bg-accent/15 text-accent' : 'border-border text-muted-foreground'
                      }`}
                    >
                      {scale}m
                    </button>
                  ))}
                </div>
              </div>
              {!spi ? (
                <SkeletonLoader rows={4} />
              ) : !spi.points.length ? (
                <p className="text-muted-foreground text-sm">Registro mensual insuficiente para el SPI.</p>
              ) : (
                <>
                  {spi.latest && spi.latest.spi !== null && (
                    <div className="mb-3 flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2">
                      <span className="font-mono text-2xl font-bold" style={{ color: spiColor(spi.latest.spi) }}>
                        {spi.latest.spi > 0 ? `+${spi.latest.spi}` : spi.latest.spi}
                      </span>
                      <span className="text-sm">
                        <span className="block font-semibold text-card-foreground">{spi.latest.category}</span>
                        <span className="block text-xs text-muted-foreground">{spi.latest.month} · acumulado {spi.latest.precipitation.toLocaleString('es-CO')} mm/{spi.scale} meses</span>
                      </span>
                    </div>
                  )}
                  <div style={{ width: '100%', height: '190px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={spiData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border" />
                        <XAxis dataKey="label" stroke="currentColor" className="text-muted-foreground" style={{ fontSize: '10px' }} minTickGap={28} />
                        <YAxis domain={[-3, 3]} stroke="currentColor" className="text-muted-foreground" style={{ fontSize: '11px' }} width={32} />
                        <Tooltip contentStyle={tooltipStyle} formatter={(value: number, name, item: { payload?: SpiPointLike }) => [`${value} (${item.payload?.category || ''})`, 'SPI']} />
                        <Bar dataKey="spi" isAnimationActive={false}>
                          {spiData.map((p) => (
                            <Cell key={p.month} fill={spiColor(p.spi)} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </>
              )}
            </div>

            <div className="rounded-xl border border-border bg-card p-6 shadow-[0_0_40px_rgba(201,162,39,0.1)]">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <h3 className="font-bold text-card-foreground">Hietograma mensual</h3>
                  <p className="text-sm text-muted-foreground">Lluvia acumulada por mes del año elegido</p>
                </div>
                <select
                  value={hyetographYear}
                  onChange={(event) => setHyetographYear(event.target.value)}
                  className="h-8 rounded-lg border border-border bg-background px-2 text-xs text-card-foreground outline-none focus:border-accent"
                  aria-label="Año del hietograma"
                >
                  {years.map((year) => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
              {!hyetograph ? (
                <SkeletonLoader rows={4} />
              ) : (
                <div style={{ width: '100%', height: '210px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={hyetographData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border" />
                      <XAxis dataKey="label" stroke="currentColor" className="text-muted-foreground" style={{ fontSize: '11px' }} />
                      <YAxis stroke="currentColor" className="text-muted-foreground" style={{ fontSize: '11px' }} width={48} />
                      <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [`${Math.round(value)} mm`, 'Acumulado']} />
                      <Bar dataKey="total" fill="#2563eb" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-border bg-card p-6 shadow-[0_0_40px_rgba(201,162,39,0.1)]">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <h3 className="font-bold text-card-foreground">Histograma de acumulados diarios</h3>
                  <p className="text-sm text-muted-foreground">
                    {histogramData
                      ? `${histogramData.dryDays.toLocaleString('es-CO')} días secos · ${histogramData.wetDays.toLocaleString('es-CO')} con lluvia · máx ${histogramData.maxDaily} mm`
                      : 'Distribución de frecuencias'}
                  </p>
                </div>
                <BarChart4 className="h-5 w-5 shrink-0 text-accent" />
              </div>
              {!histogramData ? (
                <SkeletonLoader rows={4} />
              ) : (
                <div style={{ width: '100%', height: '210px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={histogramBins}>
                      <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border" />
                      <XAxis dataKey="label" stroke="currentColor" className="text-muted-foreground" style={{ fontSize: '10px' }} minTickGap={16} label={{ value: 'mm/día', position: 'insideBottom', offset: -2, fontSize: 10 }} />
                      <YAxis stroke="currentColor" className="text-muted-foreground" style={{ fontSize: '11px' }} width={48} />
                      <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [`${value.toLocaleString('es-CO')} días`, 'Frecuencia']} labelFormatter={(v) => `${v} mm`} />
                      <Bar dataKey="dias" fill="var(--accent)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            <CloudRain className="mr-1 inline h-3.5 w-3.5 text-accent" />
            Métodos: Gumbel por momentos sobre máximos anuales (años con ≥300 días de datos; Chow, Maidment &amp; Mays) y SPI
            no-paramétrico por percentiles empíricos (variante de la guía OMM). Estos análisis son orientativos: para diseño
            definitivo valida con los datos crudos y la normativa aplicable.
          </p>
        </>
      )}
    </div>
  );
}

interface SpiPointLike {
  category?: string;
}

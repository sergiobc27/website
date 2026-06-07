import { useEffect, useMemo, useState } from 'react';
import { Activity, BarChart3, CalendarRange, Globe2, MapPin, TrendingUp } from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { SkeletonLoader } from './SkeletonLoader';
import { Slider } from './ui/slider';
import { apiJson } from '../lib/ideamApi';
import type {
  AnalyticsByRegionResponse,
  AnalyticsByStationResponse,
  AnalyticsClimatologyResponse,
  AnalyticsDatasetOverview,
  AnalyticsDatasetsOverviewResponse,
  AnalyticsInterval,
  AnalyticsMetric,
  AnalyticsTimeseriesResponse,
  MetaResponse,
} from '../../shared/ideamContracts';

const METRIC_LABELS: Record<AnalyticsMetric, string> = {
  avg: 'Promedio',
  sum: 'Suma',
  min: 'Mínimo',
  max: 'Máximo',
  count: 'Observaciones',
};

const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function formatValue(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return value.toLocaleString('es-CO', { notation: 'compact', maximumFractionDigits: 1 });
  if (abs >= 100) return value.toLocaleString('es-CO', { maximumFractionDigits: 1 });
  if (abs >= 1) return value.toLocaleString('es-CO', { maximumFractionDigits: 2 });
  return value.toLocaleString('es-CO', { maximumFractionDigits: 4 });
}

function formatCount(value: number) {
  return value.toLocaleString('es-CO');
}

function formatBucketLabel(bucket: string, interval: AnalyticsInterval) {
  if (interval === 'year') return bucket.slice(0, 4);
  if (interval === 'month') {
    const [year, month] = bucket.split('-');
    return `${MONTH_NAMES[Number(month) - 1]} ${year}`;
  }
  return bucket;
}

function formatPeriod(first: string | null, last: string | null) {
  if (!first || !last) return 'Sin datos';
  return `${first.slice(0, 4)} – ${last.slice(0, 7)}`;
}

export function Analytics() {
  const [datasetId, setDatasetId] = useState('s54a-sgyg');
  const [department, setDepartment] = useState(''); // '' = todo el país
  const [interval, setInterval] = useState<AnalyticsInterval>('year');
  const [metric, setMetric] = useState<AnalyticsMetric>('avg');
  // Rango de años seleccionado [desde, hasta]; null = aún sin límites conocidos
  // (se inicializan al rango completo del dataset cuando llega el overview).
  const [yearRange, setYearRange] = useState<[number, number] | null>(null);
  const [yearTouched, setYearTouched] = useState(false);

  const [departments, setDepartments] = useState<string[]>([]);
  const [overview, setOverview] = useState<AnalyticsDatasetOverview[]>([]);
  const [timeseries, setTimeseries] = useState<AnalyticsTimeseriesResponse | null>(null);
  const [climatology, setClimatology] = useState<AnalyticsClimatologyResponse | null>(null);
  const [regions, setRegions] = useState<AnalyticsByRegionResponse | null>(null);
  const [monthlySeries, setMonthlySeries] = useState<AnalyticsTimeseriesResponse | null>(null);
  const [topStations, setTopStations] = useState<AnalyticsByStationResponse | null>(null);

  const [isLoadingSeries, setIsLoadingSeries] = useState(true);
  const [isLoadingPanels, setIsLoadingPanels] = useState(true);
  const [error, setError] = useState('');

  // Límites de años disponibles del dataset elegido (del overview).
  const datasetBounds = useMemo(() => {
    const found = overview.find((d) => d.id === datasetId);
    const start = found?.firstObservation ? Number(found.firstObservation.slice(0, 4)) : 2003;
    const end = found?.lastObservation ? Number(found.lastObservation.slice(0, 4)) : new Date().getFullYear();
    return { start, end };
  }, [overview, datasetId]);

  // Al cambiar de dataset (o al cargar), reencuadra el rango. Si el usuario ya
  // lo tocó, CLAMPEA su selección a los nuevos límites en vez de dejarla fuera
  // (evita emitir fechas anteriores al inicio del dataset → "Sin datos" sin
  // explicación; auditoría #5 #7).
  useEffect(() => {
    setYearRange((prev) => {
      if (!yearTouched || !prev) return [datasetBounds.start, datasetBounds.end];
      const lo = Math.min(Math.max(prev[0], datasetBounds.start), datasetBounds.end);
      const hi = Math.max(Math.min(prev[1], datasetBounds.end), datasetBounds.start);
      return [Math.min(lo, hi), Math.max(lo, hi)];
    });
  }, [datasetBounds.start, datasetBounds.end, yearTouched]);

  // El rango solo viaja al backend si NO es el completo (evita filtrar de más).
  const dateParams = useMemo(() => {
    if (!yearRange) return {};
    const [from, to] = yearRange;
    const params: { startDate?: string; endDate?: string } = {};
    if (from > datasetBounds.start) params.startDate = `${from}-01-01`;
    if (to < datasetBounds.end) params.endDate = `${to}-12-31`;
    return params;
  }, [yearRange, datasetBounds]);

  const scopePayload = useMemo(
    () => ({ datasetId, departments: department ? [department] : [], ...dateParams }),
    [datasetId, department, dateParams]
  );

  useEffect(() => {
    const load = async () => {
      try {
        const [meta, ov] = await Promise.all([
          apiJson<MetaResponse>('/api/meta', undefined, 'No fue posible cargar la metadata.'),
          apiJson<AnalyticsDatasetsOverviewResponse>(
            '/api/analytics/datasets-overview',
            undefined,
            'No fue posible cargar el resumen de datasets.'
          ),
        ]);
        setDepartments(meta.departments || []);
        setOverview(ov.datasets || []);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'No fue posible cargar la analítica.');
      }
    };
    void load();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      setIsLoadingSeries(true);
      setError('');
      try {
        const data = await apiJson<AnalyticsTimeseriesResponse>(
          '/api/analytics/timeseries',
          {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ ...scopePayload, interval, metric }),
            signal: controller.signal,
          },
          'No fue posible cargar la serie temporal.'
        );
        setTimeseries(data);
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : 'No fue posible cargar la serie temporal.');
        }
      } finally {
        if (!controller.signal.aborted) setIsLoadingSeries(false);
      }
    };
    void load();
    return () => controller.abort();
  }, [scopePayload, interval, metric]);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      setIsLoadingPanels(true);
      try {
        const [clim, byRegion] = await Promise.all([
          apiJson<AnalyticsClimatologyResponse>(
            '/api/analytics/monthly-climatology',
            {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify(scopePayload),
              signal: controller.signal,
            },
            'No fue posible cargar la climatología.'
          ),
          apiJson<AnalyticsByRegionResponse>(
            '/api/analytics/by-region',
            {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify(scopePayload),
              signal: controller.signal,
            },
            'No fue posible cargar el comparativo por departamento.'
          ),
        ]);
        setClimatology(clim);
        setRegions(byRegion);
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : 'No fue posible cargar los paneles.');
        }
      } finally {
        if (!controller.signal.aborted) setIsLoadingPanels(false);
      }
    };
    void load();
    return () => controller.abort();
  }, [scopePayload]);

  // Serie mensual reciente (para anomalías) + top de estaciones: secundarios,
  // no bloquean los paneles principales si fallan.
  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      const since = new Date();
      since.setMonth(since.getMonth() - 24);
      try {
        const [monthly, byStation] = await Promise.all([
          apiJson<AnalyticsTimeseriesResponse>(
            '/api/analytics/timeseries',
            {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({
                ...scopePayload,
                interval: 'month',
                metric: 'avg',
                startDate: since.toISOString().slice(0, 10),
              }),
              signal: controller.signal,
            },
            'No fue posible cargar la serie mensual reciente.'
          ),
          apiJson<AnalyticsByStationResponse>(
            '/api/analytics/by-station',
            {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify(scopePayload),
              signal: controller.signal,
            },
            'No fue posible cargar el ranking de estaciones.'
          ),
        ]);
        setMonthlySeries(monthly);
        setTopStations(byStation);
      } catch {
        if (!controller.signal.aborted) {
          setMonthlySeries(null);
          setTopStations(null);
        }
      }
    };
    void load();
    return () => controller.abort();
  }, [scopePayload]);

  const selectedDataset = overview.find((item) => item.id === datasetId);
  const metricLabel = METRIC_LABELS[metric];
  const scopeLabel = department || 'Todo el país';

  const seriesData = useMemo(
    () =>
      (timeseries?.points || [])
        .filter((point) => point.value !== null)
        .map((point) => ({
          label: formatBucketLabel(point.bucket, interval),
          valor: point.value,
          n: point.n,
        })),
    [timeseries, interval]
  );

  const climatologyData = useMemo(
    () =>
      (climatology?.months || []).map((item) => ({
        label: MONTH_NAMES[item.month - 1],
        media: item.mean,
        mínimo: item.min,
        máximo: item.max,
      })),
    [climatology]
  );

  const regionData = useMemo(
    () =>
      (regions?.regions || [])
        .slice(0, 10)
        .map((item) => ({
          label: item.department,
          observaciones: item.rowCount,
          media: item.mean,
          estaciones: item.stationCount,
        })),
    [regions]
  );

  // Anomalía = desviación % del mes observado frente a su media climatológica
  // (misma combinación de filtros). Cálculo 100% en el cliente: ambas series
  // ya están cargadas.
  const anomalyData = useMemo(() => {
    if (!monthlySeries || !climatology) return [];
    const climByMonth = new Map(climatology.months.map((m) => [m.month, m.mean]));
    return monthlySeries.points
      .filter((point) => point.value !== null)
      .slice(-24)
      .flatMap((point) => {
        const month = Number(point.bucket.slice(5, 7));
        const clim = climByMonth.get(month);
        if (!clim) return [];
        const pct = (((point.value as number) - clim) / clim) * 100;
        return [{ label: formatBucketLabel(point.bucket, 'month'), anomalia: Math.round(pct * 10) / 10 }];
      });
  }, [monthlySeries, climatology]);

  const stationRows = (topStations?.stations || []).slice(0, 10);

  const tooltipStyle = {
    backgroundColor: 'var(--background)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    color: 'var(--foreground)',
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-card-foreground text-2xl font-bold">Analítica del espejo IDEAM</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Tendencias, climatología y cobertura calculadas sobre el conjunto completo de observaciones.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 shadow-[0_0_20px] shadow-accent/10">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <ControlSelect
            label="Variable"
            value={datasetId}
            onChange={setDatasetId}
            options={overview.map((item) => ({ value: item.id, label: item.name }))}
          />
          <ControlSelect
            label="Ámbito"
            value={department}
            onChange={setDepartment}
            options={[{ value: '', label: 'Todo el país' }, ...departments.map((dep) => ({ value: dep, label: dep }))]}
          />
          <ControlSelect
            label="Intervalo"
            value={interval}
            onChange={(value) => setInterval(value as AnalyticsInterval)}
            options={[
              { value: 'year', label: 'Anual' },
              { value: 'month', label: 'Mensual' },
            ]}
          />
          <ControlSelect
            label="Métrica"
            value={metric}
            onChange={(value) => setMetric(value as AnalyticsMetric)}
            options={(Object.keys(METRIC_LABELS) as AnalyticsMetric[]).map((key) => ({
              value: key,
              label: METRIC_LABELS[key],
            }))}
          />
        </div>

        {yearRange && datasetBounds.end > datasetBounds.start && (
          <div className="mt-4 flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold uppercase tracking-wide text-muted-foreground">Rango de años</span>
              <span className="font-mono text-card-foreground">
                {yearRange[0]} – {yearRange[1]}
                {yearTouched && (
                  <button
                    type="button"
                    onClick={() => {
                      setYearTouched(false);
                      setYearRange([datasetBounds.start, datasetBounds.end]);
                    }}
                    className="ml-2 text-accent hover:underline"
                  >
                    (todo)
                  </button>
                )}
              </span>
            </div>
            <Slider
              min={datasetBounds.start}
              max={datasetBounds.end}
              step={1}
              value={yearRange}
              onValueChange={(value) => {
                setYearTouched(true);
                setYearRange([value[0], value[1] ?? value[0]]);
              }}
              aria-label="Rango de años a analizar"
            />
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-border bg-card p-6 shadow-[0_0_40px_rgba(201,162,39,0.1)]">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-card-foreground">
              {metricLabel} {interval === 'year' ? 'anual' : 'mensual'} · {selectedDataset?.name || datasetId}
            </h3>
            <p className="text-sm text-muted-foreground">{scopeLabel}</p>
          </div>
          <TrendingUp className="h-5 w-5 shrink-0 text-accent" />
        </div>
        {isLoadingSeries ? (
          <SkeletonLoader rows={4} />
        ) : seriesData.length === 0 ? (
          <p className="text-muted-foreground text-sm">Sin datos para esta combinación de filtros.</p>
        ) : (
          <div style={{ width: '100%', height: '300px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={seriesData}>
                <defs>
                  <linearGradient id="serieGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border" />
                <XAxis dataKey="label" stroke="currentColor" className="text-muted-foreground" style={{ fontSize: '12px' }} minTickGap={24} />
                <YAxis stroke="currentColor" className="text-muted-foreground" style={{ fontSize: '12px' }} tickFormatter={(v: number) => formatValue(v)} width={70} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value: number, name: string, item: { payload?: { n?: number } }) => [
                    `${formatValue(value)} (${formatCount(item.payload?.n ?? 0)} obs.)`,
                    metricLabel,
                  ]}
                />
                <Area type="monotone" dataKey="valor" stroke="var(--accent)" strokeWidth={2} fill="url(#serieGradient)" isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-6 shadow-[0_0_40px_rgba(201,162,39,0.1)]">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-card-foreground">Climatología mensual</h3>
              <p className="text-sm text-muted-foreground">Promedio histórico y extremos por mes · {scopeLabel}</p>
            </div>
            <CalendarRange className="h-5 w-5 shrink-0 text-accent" />
          </div>
          {isLoadingPanels ? (
            <SkeletonLoader rows={4} />
          ) : (
            <div style={{ width: '100%', height: '260px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={climatologyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border" />
                  <XAxis dataKey="label" stroke="currentColor" className="text-muted-foreground" style={{ fontSize: '12px' }} />
                  <YAxis stroke="currentColor" className="text-muted-foreground" style={{ fontSize: '12px' }} tickFormatter={(v: number) => formatValue(v)} width={70} />
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
          <div className="mb-6 flex items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-card-foreground">Top 10 departamentos</h3>
              <p className="text-sm text-muted-foreground">Por volumen de observaciones de {selectedDataset?.name || datasetId}</p>
            </div>
            <MapPin className="h-5 w-5 shrink-0 text-accent" />
          </div>
          {isLoadingPanels ? (
            <SkeletonLoader rows={4} />
          ) : regionData.length === 0 ? (
            <p className="text-muted-foreground text-sm">Sin datos para esta combinación de filtros.</p>
          ) : (
            <div style={{ width: '100%', height: '260px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={regionData} layout="vertical" margin={{ left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border" />
                  <XAxis type="number" stroke="currentColor" className="text-muted-foreground" style={{ fontSize: '11px' }} tickFormatter={(v: number) => formatValue(v)} />
                  <YAxis type="category" dataKey="label" stroke="currentColor" className="text-muted-foreground" style={{ fontSize: '11px' }} width={130} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value: number, name: string, item: { payload?: { label?: string; media?: number | null; estaciones?: number } }) => [
                      `${formatCount(value)} obs. · media ${formatValue(item.payload?.media)} · ${formatCount(item.payload?.estaciones ?? 0)} estaciones`,
                      item.payload?.label ?? '',
                    ]}
                  />
                  <Bar dataKey="observaciones" fill="var(--primary)" radius={[0, 6, 6, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-6 shadow-[0_0_40px_rgba(201,162,39,0.1)]">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-card-foreground">Anomalías mensuales (últimos 24 meses)</h3>
              <p className="text-sm text-muted-foreground">Desviación % vs el promedio histórico del mismo mes · {scopeLabel}</p>
            </div>
            <Activity className="h-5 w-5 shrink-0 text-accent" />
          </div>
          {anomalyData.length === 0 ? (
            <p className="text-muted-foreground text-sm">Sin datos suficientes para calcular anomalías.</p>
          ) : (
            <div style={{ width: '100%', height: '240px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={anomalyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border" />
                  <XAxis dataKey="label" stroke="currentColor" className="text-muted-foreground" style={{ fontSize: '11px' }} minTickGap={20} />
                  <YAxis stroke="currentColor" className="text-muted-foreground" style={{ fontSize: '11px' }} tickFormatter={(v: number) => `${v}%`} width={56} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [`${value > 0 ? '+' : ''}${value}% vs lo normal`, 'Anomalía']} />
                  <Bar dataKey="anomalia" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                    {anomalyData.map((entry) => (
                      <Cell key={entry.label} fill={entry.anomalia >= 0 ? '#2563eb' : '#A3161A'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-[0_0_40px_rgba(201,162,39,0.1)]">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-card-foreground">Top 10 estaciones</h3>
              <p className="text-sm text-muted-foreground">Por volumen de observaciones · {scopeLabel}</p>
            </div>
            <MapPin className="h-5 w-5 shrink-0 text-accent" />
          </div>
          {stationRows.length === 0 ? (
            <p className="text-muted-foreground text-sm">Sin datos para esta combinación de filtros.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 pr-3 font-semibold">Estación</th>
                    <th className="py-2 pr-3 font-semibold">Municipio</th>
                    <th className="py-2 pr-3 text-right font-semibold">Obs.</th>
                    <th className="py-2 text-right font-semibold">Última obs.</th>
                  </tr>
                </thead>
                <tbody>
                  {stationRows.map((station) => (
                    <tr key={station.code} className="border-b border-border/60">
                      <td className="py-2 pr-3 font-mono text-card-foreground">{station.code}</td>
                      <td className="py-2 pr-3 text-muted-foreground">{station.municipality || 'N/D'}</td>
                      <td className="py-2 pr-3 text-right font-mono text-card-foreground">{formatCount(station.rowCount)}</td>
                      <td className="py-2 text-right text-muted-foreground">{station.lastObservation?.slice(0, 7) || 'N/D'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 shadow-[0_0_40px_rgba(201,162,39,0.1)]">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-card-foreground">Cobertura del espejo por variable</h3>
            <p className="text-sm text-muted-foreground">Haz clic en una variable para analizarla.</p>
          </div>
          <Globe2 className="h-5 w-5 shrink-0 text-accent" />
        </div>
        {overview.length === 0 ? (
          <SkeletonLoader rows={4} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-4 font-semibold">Variable</th>
                  <th className="py-2 pr-4 font-semibold">Categoría</th>
                  <th className="py-2 pr-4 text-right font-semibold">Observaciones</th>
                  <th className="py-2 pr-4 text-right font-semibold">Estaciones</th>
                  <th className="py-2 text-right font-semibold">Período</th>
                </tr>
              </thead>
              <tbody>
                {overview.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => setDatasetId(item.id)}
                    className={`cursor-pointer border-b border-border/60 transition-colors hover:bg-muted/60 ${
                      item.id === datasetId ? 'bg-accent/10' : ''
                    }`}
                  >
                    <td className="py-2.5 pr-4 font-semibold text-card-foreground">
                      <span className="flex items-center gap-2">
                        {item.id === datasetId ? <Activity className="h-3.5 w-3.5 text-accent" /> : <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />}
                        {item.name}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 text-muted-foreground">{item.category}</td>
                    <td className="py-2.5 pr-4 text-right font-mono text-card-foreground">{formatCount(item.rowCount)}</td>
                    <td className="py-2.5 pr-4 text-right font-mono text-card-foreground">{formatCount(item.stationCount)}</td>
                    <td className="py-2.5 text-right text-muted-foreground">{formatPeriod(item.firstObservation, item.lastObservation)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function ControlSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-xs text-muted-foreground">
      <span className="font-semibold uppercase tracking-wide">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-card-foreground outline-none transition-colors focus:border-accent"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

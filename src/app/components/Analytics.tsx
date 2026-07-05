import { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, BarChart3 } from 'lucide-react';
import { InfoGrafica } from './InfoGrafica';
import { ChartDownloadButton } from './ChartDownloadButton';
import { ControlSelect } from './ControlSelect';
import { HeatmapClimatico } from './HeatmapClimatico';
import { useUrlSync } from '../lib/urlState';
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
import { Bar as MeanBar, Formula, Frac, V } from './Formula';
import { apiJson } from '../lib/ideamApi';
import { metricUnit, unitSuffix } from '../lib/units';
import { formatValue } from '../lib/format';
import { MONTH_NAMES, PRECIP_DATASET } from '../lib/constants';
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
  const chartRef = useRef<HTMLDivElement>(null);
  const climatoChartRef = useRef<HTMLDivElement>(null);
  const regionChartRef = useRef<HTMLDivElement>(null);
  const anomalyChartRef = useRef<HTMLDivElement>(null);
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

  // Estado en la URL: ?var=<dataset>&dep=<depto>&int=year&metric=avg&years=2000-2020.
  useUrlSync({
    params: {
      var: datasetId === 's54a-sgyg' ? undefined : datasetId,
      dep: department || undefined,
      int: interval === 'year' ? undefined : interval,
      metric: metric === 'avg' ? undefined : metric,
      // Solo si el usuario lo cambió: el rango auto-inicializado (límites del
      // dataset) es el default y no debe ensuciar la URL.
      years: yearTouched && yearRange ? `${yearRange[0]}-${yearRange[1]}` : undefined,
    },
    onRestore: (p) => {
      if (p.var) setDatasetId(p.var);
      if (p.dep) setDepartment(p.dep);
      if (p.int === 'day' || p.int === 'month' || p.int === 'year') setInterval(p.int);
      if (['avg', 'sum', 'min', 'max', 'count'].includes(p.metric)) setMetric(p.metric as AnalyticsMetric);
      const m = p.years?.match(/^(\d{4})-(\d{4})$/);
      if (m) {
        setYearRange([Number(m[1]), Number(m[2])]);
        setYearTouched(true);
      }
    },
  });

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

  // Precipitación: la métrica con sentido es la LÁMINA acumulada (mm), no el
  // promedio por lectura de 10 min (~0,05 mm). Forzamos 'sum' en la serie y el
  // heatmap, y mostramos la lámina mensual (mm/mes) en climatología y por
  // departamento. El resto de variables conserva la métrica elegida.
  const isPrecip = datasetId === PRECIP_DATASET;
  const effectiveMetric: AnalyticsMetric = isPrecip ? 'sum' : metric;

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
            body: JSON.stringify({ ...scopePayload, interval, metric: effectiveMetric }),
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
  }, [scopePayload, interval, effectiveMetric]);

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
                // Precip: lámina mensual (sum) para que la anomalía compare
                // mm/mes vs mm/mes; el resto mantiene avg.
                metric: isPrecip ? 'sum' : 'avg',
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
  const metricLabel = isPrecip ? 'Lámina' : METRIC_LABELS[metric];
  const scopeLabel = department || 'Todo el país';
  const seriesUnit = metricUnit(datasetId, effectiveMetric); // unidad de la métrica (mm, °C, obs...)
  const varUnit = metricUnit(datasetId, 'avg'); // unidad física de la variable

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
        // Precip: lámina mensual media (mm/mes) y su mín/máx histórico; resto: avg/min/max.
        media: isPrecip ? item.monthlyDepth ?? null : item.mean,
        mínimo: isPrecip ? item.monthlyDepthMin ?? null : item.min,
        máximo: isPrecip ? item.monthlyDepthMax ?? null : item.max,
      })),
    [climatology, isPrecip]
  );

  const regionData = useMemo(
    () =>
      (regions?.regions || [])
        .slice(0, 10)
        .map((item) => ({
          label: item.department,
          observaciones: item.rowCount,
          // Precip: lámina mensual media (mm/mes); resto: avg por lectura.
          media: isPrecip ? item.monthlyDepth ?? null : item.mean,
          estaciones: item.stationCount,
        })),
    [regions, isPrecip]
  );

  // Anomalía = desviación % del mes observado frente a su media climatológica
  // (misma combinación de filtros). Cálculo 100% en el cliente: ambas series
  // ya están cargadas.
  const anomalyData = useMemo(() => {
    if (!monthlySeries || !climatology) return [];
    const climByMonth = new Map(
      climatology.months.map((m) => [m.month, isPrecip ? m.monthlyDepth ?? null : m.mean])
    );
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
  }, [monthlySeries, climatology, isPrecip]);

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

      <div className="rounded-xl border border-border bg-card p-4">
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
            value={isPrecip ? 'sum' : metric}
            onChange={(value) => setMetric(value as AnalyticsMetric)}
            options={
              // Para precipitación la única métrica con sentido es la lámina
              // acumulada (mm); ocultamos el promedio-por-lectura.
              isPrecip
                ? [{ value: 'sum', label: 'Lámina (mm)' }]
                : (Object.keys(METRIC_LABELS) as AnalyticsMetric[]).map((key) => ({
                    value: key,
                    label: METRIC_LABELS[key],
                  }))
            }
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

      <div className="rounded-xl border border-border bg-card p-6 shadow-glow">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-card-foreground">
              {metricLabel} {interval === 'year' ? 'anual' : 'mensual'} de {selectedDataset?.name || datasetId}{unitSuffix(seriesUnit)}
            </h3>
            <p className="text-sm text-muted-foreground">{scopeLabel}</p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <InfoGrafica id="serie-temporal" />
            {seriesData.length > 0 && (
              <ChartDownloadButton targetRef={chartRef} title={`${metricLabel} de ${selectedDataset?.name || datasetId}`} subtitle={scopeLabel} filenameParts={['analitica', selectedDataset?.name || datasetId]} />
            )}
          </div>
        </div>
        {isLoadingSeries ? (
          <SkeletonLoader rows={4} />
        ) : seriesData.length === 0 ? (
          <p className="text-muted-foreground text-sm">Sin datos para esta combinación de filtros.</p>
        ) : (
          <div ref={chartRef} className="bg-card" style={{ width: '100%', height: '300px' }}>
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
                <YAxis stroke="currentColor" className="text-muted-foreground" style={{ fontSize: '12px' }} tickFormatter={(v: number) => formatValue(v)} width={70} label={{ value: `${metricLabel}${unitSuffix(seriesUnit)}`, angle: -90, position: 'insideLeft', style: { fontSize: 10, textAnchor: 'middle' } }} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value: number, name: string, item: { payload?: { n?: number } }) => [
                    `${formatValue(value)}${seriesUnit ? ' ' + seriesUnit : ''} (${formatCount(item.payload?.n ?? 0)} obs.)`,
                    metricLabel,
                  ]}
                />
                <Area type="monotone" dataKey="valor" stroke="var(--accent)" strokeWidth={2} fill="url(#serieGradient)" isAnimationActive animationDuration={550} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <HeatmapClimatico datasetId={datasetId} department={department} metric={effectiveMetric} anioMin={datasetBounds.start} anioMax={datasetBounds.end} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-card-foreground">Climatología mensual{unitSuffix(varUnit)}</h3>
              <p className="text-sm text-muted-foreground">
                {isPrecip ? 'Lámina mensual media y extremos por mes' : 'Promedio histórico y extremos por mes'} · {scopeLabel}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <InfoGrafica id="climatologia" />
              {!isLoadingPanels && (
                <ChartDownloadButton
                  targetRef={climatoChartRef}
                  title="Climatología mensual"
                  subtitle={scopeLabel}
                  filenameParts={['climatologia', selectedDataset?.name || datasetId]}
                />
              )}
            </div>
          </div>
          {isLoadingPanels ? (
            <SkeletonLoader rows={4} />
          ) : (
            <div ref={climatoChartRef} className="bg-card" style={{ width: '100%', height: '260px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={climatologyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border" />
                  <XAxis dataKey="label" stroke="currentColor" className="text-muted-foreground" style={{ fontSize: '12px' }} />
                  <YAxis stroke="currentColor" className="text-muted-foreground" style={{ fontSize: '12px' }} tickFormatter={(v: number) => formatValue(v)} width={70} label={{ value: varUnit, angle: -90, position: 'insideLeft', style: { fontSize: 10, textAnchor: 'middle' } }} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(value: number, name: string) => [`${formatValue(value)}${varUnit ? ' ' + varUnit : ''}`, name]} />
                  <Bar dataKey="media" fill="var(--accent)" radius={[6, 6, 0, 0]} isAnimationActive animationDuration={550} />
                  <Line type="monotone" dataKey="máximo" stroke="var(--primary)" strokeWidth={1.5} dot={false} isAnimationActive animationDuration={550} />
                  <Line type="monotone" dataKey="mínimo" stroke="currentColor" className="text-muted-foreground" strokeWidth={1.5} dot={false} isAnimationActive animationDuration={550} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-6">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-card-foreground">Top 10 departamentos</h3>
              <p className="text-sm text-muted-foreground">Por volumen de observaciones de {selectedDataset?.name || datasetId}</p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <InfoGrafica id="top-departamentos" />
              {!isLoadingPanels && regionData.length > 0 && (
                <ChartDownloadButton
                  targetRef={regionChartRef}
                  title="Top 10 departamentos"
                  subtitle={selectedDataset?.name || datasetId}
                  filenameParts={['top-departamentos', selectedDataset?.name || datasetId]}
                />
              )}
            </div>
          </div>
          {isLoadingPanels ? (
            <SkeletonLoader rows={4} />
          ) : regionData.length === 0 ? (
            <p className="text-muted-foreground text-sm">Sin datos para esta combinación de filtros.</p>
          ) : (
            <div ref={regionChartRef} className="bg-card" style={{ width: '100%', height: '260px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={regionData} layout="vertical" margin={{ left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border" />
                  <XAxis type="number" stroke="currentColor" className="text-muted-foreground" style={{ fontSize: '11px' }} tickFormatter={(v: number) => formatValue(v)} />
                  <YAxis type="category" dataKey="label" stroke="currentColor" className="text-muted-foreground" style={{ fontSize: '11px' }} width={130} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value: number, name: string, item: { payload?: { label?: string; media?: number | null; estaciones?: number } }) => [
                      `${formatCount(value)} obs. · ${isPrecip ? 'lámina' : 'media'} ${formatValue(item.payload?.media)}${isPrecip ? ' mm/mes' : varUnit ? ' ' + varUnit : ''} · ${formatCount(item.payload?.estaciones ?? 0)} estaciones`,
                      item.payload?.label ?? '',
                    ]}
                  />
                  <Bar dataKey="observaciones" fill="var(--primary)" radius={[0, 6, 6, 0]} isAnimationActive animationDuration={550} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-card-foreground">Anomalías mensuales (últimos 24 meses)</h3>
              <p className="text-sm text-muted-foreground">Desviación % vs el promedio histórico del mismo mes · {scopeLabel}</p>
              <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                <Formula className="text-card-foreground">
                  anomalía&nbsp;=&nbsp;<Frac num={<><V>P</V> − <MeanBar><V>P</V></MeanBar></>} den={<><MeanBar><V>P</V></MeanBar></>} />&nbsp;× 100&nbsp;%
                </Formula>
                <span>(<V>P</V> = lluvia del mes; <MeanBar><V>P</V></MeanBar> = promedio histórico de ese mes)</span>
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <InfoGrafica id="anomalias" />
              {anomalyData.length > 0 && (
                <ChartDownloadButton
                  targetRef={anomalyChartRef}
                  title="Anomalías mensuales (últimos 24 meses)"
                  subtitle={scopeLabel}
                  filenameParts={['anomalias', selectedDataset?.name || datasetId]}
                />
              )}
            </div>
          </div>
          {anomalyData.length === 0 ? (
            <p className="text-muted-foreground text-sm">Sin datos suficientes para calcular anomalías.</p>
          ) : (
            <div ref={anomalyChartRef} className="bg-card" style={{ width: '100%', height: '240px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={anomalyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border" />
                  <XAxis dataKey="label" stroke="currentColor" className="text-muted-foreground" style={{ fontSize: '11px' }} minTickGap={20} />
                  <YAxis stroke="currentColor" className="text-muted-foreground" style={{ fontSize: '11px' }} tickFormatter={(v: number) => `${v}%`} width={56} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [`${value > 0 ? '+' : ''}${formatValue(value)}% vs lo normal`, 'Anomalía']} />
                  <Bar dataKey="anomalia" radius={[4, 4, 0, 0]} isAnimationActive animationDuration={550}>
                    {anomalyData.map((entry) => (
                      <Cell key={entry.label} fill={entry.anomalia >= 0 ? '#2563eb' : '#A3161A'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-6">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-card-foreground">Top 10 estaciones</h3>
              <p className="text-sm text-muted-foreground">Por volumen de observaciones · {scopeLabel}</p>
            </div>
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

      <div className="rounded-xl border border-border bg-card p-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-card-foreground">Cobertura del espejo por variable</h3>
            <p className="text-sm text-muted-foreground">Haz clic en una variable para analizarla.</p>
          </div>
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
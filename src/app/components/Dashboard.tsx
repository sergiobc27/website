import { useEffect, useMemo, useRef, useState } from 'react';
import { Clock3, Database, Download, MapPin, RefreshCw, Waves } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { SkeletonLoader } from './SkeletonLoader';
import { ChartDownloadButton } from './ChartDownloadButton';
import { apiJson } from '../lib/ideamApi';
import { fmt } from '../lib/format';
import type { DataFreshness, MetaResponse } from '../../shared/ideamContracts';

interface HistoryEntry {
  timestamp: string;
  variable: string;
  format: string;
  rowCount: number;
  stationCount: number;
  municipalityCount: number;
  zoneCount: number;
  processingMs: number;
  sizeBytes: number;
  fileName: string;
}

function formatDuration(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '0 s';
  if (value < 60000) return `${fmt(value / 1000, value < 10000 ? 1 : 0)} s`;
  const totalSeconds = Math.round(value / 1000);
  return `${Math.floor(totalSeconds / 60)}m ${String(totalSeconds % 60).padStart(2, '0')}s`;
}

function formatFreshnessDate(iso: string | null) {
  if (!iso) return 'Sin datos';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Sin datos';
  return date.toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' });
}

function formatFreshnessRelative(iso: string | null) {
  if (!iso) return '';
  const elapsedMs = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return '';
  const minutes = Math.round(elapsedMs / 60000);
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `hace ${hours} h`;
  return `hace ${Math.round(hours / 24)} días`;
}

export function Dashboard() {
  const chartRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [datasets, setDatasets] = useState<Array<{ id: string; name: string }>>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [freshness, setFreshness] = useState<DataFreshness | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        // apiJson resuelve el origen correcto también fuera de producción
        // (previews *.pages.dev) y normaliza errores.
        const data = await apiJson<MetaResponse>('/api/meta', undefined, 'No fue posible cargar la metadata.');
        setDatasets(data.datasets || []);
        setFreshness(data.dataFreshness || null);
      } catch {
        // El dashboard sigue útil con el historial local aunque falle la metadata.
      } finally {
        setHistory(JSON.parse(localStorage.getItem('ideam-history') || '[]'));
        setTimeout(() => setIsLoading(false), 400);
      }
    };
    void load();
  }, []);

  const totals = useMemo(() => {
    const totalRows = history.reduce((sum, item) => sum + Number(item.rowCount || 0), 0);
    const totalStations = history.reduce((sum, item) => sum + Number(item.stationCount || 0), 0);
    const totalTime = history.reduce((sum, item) => sum + Number(item.processingMs || 0), 0);
    return {
      rows: totalRows,
      stations: totalStations,
      timeMs: totalTime,
      avgTimeMs: history.length ? Math.round(totalTime / history.length) : 0,
    };
  }, [history]);

  const chartData = useMemo(
    () =>
      history
        .slice(0, 7)
        .map((item, index) => ({
          id: index + 1,
          label: item.timestamp.slice(0, 10),
          filas: Number(item.rowCount || 0),
          estaciones: Number(item.stationCount || 0),
          tiempo: Math.round(Number(item.processingMs || 0) / 1000),
        }))
        .reverse(),
    [history]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 rounded-xl border border-border bg-card px-4 py-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <span className="flex items-center gap-2">
          <Database className="h-3.5 w-3.5 shrink-0 text-accent" />
          Fuente: IDEAM, datos abiertos de Colombia (datos.gov.co). Espejo propio sincronizado dos veces al día.
        </span>
        {freshness && (freshness.latestObservation || freshness.lastSync) && (
          <span className="flex items-center gap-2 sm:text-right">
            <RefreshCw className="h-3.5 w-3.5 shrink-0 text-accent" />
            <span>
              Dato más reciente: <span className="font-semibold text-card-foreground">{formatFreshnessDate(freshness.latestObservation)}</span>
              {freshness.lastSync ? ` · sincronizado ${formatFreshnessRelative(freshness.lastSync)}` : ''}
            </span>
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={Database} title="Datasets disponibles" value={String(datasets.length)} subtitle="Catalogo operativo" />
        <MetricCard icon={Download} title="Filas descargadas" value={totals.rows.toLocaleString('es-CO')} subtitle={`${history.length} ejecuciones`} />
        <MetricCard icon={MapPin} title="Estaciones procesadas" value={totals.stations.toLocaleString('es-CO')} subtitle="Suma del historial local" />
        <MetricCard icon={Clock3} title="Tiempo medio" value={formatDuration(totals.avgTimeMs)} subtitle="Promedio por descarga" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-6 shadow-[0_0_40px_rgba(201,162,39,0.1)]">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-card-foreground">Rendimiento reciente</h3>
              <p className="text-sm text-muted-foreground">Filas y estaciones por ejecucion</p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <ChartDownloadButton targetRef={chartRef} title="Rendimiento reciente" filenameParts={['dashboard', 'rendimiento']} />
              <Waves className="h-5 w-5 shrink-0 text-accent" />
            </div>
          </div>
          <div ref={chartRef} className="bg-card" style={{ width: '100%', height: '260px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData.length ? chartData : [{ label: '-', filas: 0, estaciones: 0 }]}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border" />
                <XAxis dataKey="label" stroke="currentColor" className="text-muted-foreground" style={{ fontSize: '12px' }} />
                <YAxis stroke="currentColor" className="text-muted-foreground" style={{ fontSize: '12px' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--background)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    color: 'var(--foreground)',
                  }}
                />
                <Bar dataKey="filas" fill="var(--primary)" radius={[8, 8, 0, 0]} isAnimationActive={false} />
                <Bar dataKey="estaciones" fill="var(--accent)" radius={[8, 8, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-[0_0_40px_rgba(201,162,39,0.1)]">
          <h3 className="mb-4 font-bold text-card-foreground">Impacto visible</h3>
          <div className="space-y-4 text-sm">
            <SummaryRow label="Última ejecución" value={history[0]?.timestamp || 'Sin registros'} />
            <SummaryRow label="Tiempo total acumulado" value={formatDuration(totals.timeMs)} />
            <SummaryRow
              label="Mayor volumen descargado"
              value={history.length ? `${Math.max(...history.map((item) => Number(item.rowCount || 0))).toLocaleString('es-CO')} filas` : 'Sin datos'}
            />
            <SummaryRow
              label="Mayor cobertura municipal"
              value={history.length ? `${Math.max(...history.map((item) => Number(item.municipalityCount || 0))).toLocaleString('es-CO')} municipios` : 'Sin datos'}
            />
            <SummaryRow
              label="Mayor cobertura de zonas"
              value={history.length ? `${Math.max(...history.map((item) => Number(item.zoneCount || 0))).toLocaleString('es-CO')} zonas` : 'Sin datos'}
            />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 shadow-[0_0_40px_rgba(201,162,39,0.1)]">
        <h3 className="mb-4 font-bold text-card-foreground">Descargas recientes</h3>
        {isLoading ? (
          <SkeletonLoader rows={3} />
        ) : history.length === 0 ? (
          <p className="text-muted-foreground">Aún no hay descargas registradas en este navegador.</p>
        ) : (
          <div className="space-y-3">
            {history.slice(0, 5).map((item, index) => (
              <div key={`${item.fileName}-${index}`} className="flex flex-col gap-3 rounded-lg border border-border bg-background p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-semibold text-card-foreground">{item.variable}</p>
                  <p className="break-words text-xs text-muted-foreground">
                    {item.rowCount.toLocaleString('es-CO')} filas | {Number(item.stationCount || 0).toLocaleString('es-CO')} estaciones | {Number(item.municipalityCount || 0).toLocaleString('es-CO')} municipios
                  </p>
                </div>
                <div className="text-xs text-muted-foreground sm:text-right">
                  <p>{item.format.toUpperCase()}</p>
                  <p>{formatDuration(item.processingMs)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  title,
  value,
  subtitle,
}: {
  icon: React.ElementType;
  title: string;
  value: string;
  subtitle: string;
}) {
  return (
    <div className="min-h-[150px] rounded-xl border border-border bg-card p-6 shadow-[0_0_20px] shadow-accent/10">
      <div className="mb-4 flex items-start justify-between">
        <Icon className="h-7 w-7 text-accent" />
      </div>
      <p className="mb-1 text-sm text-muted-foreground">{title}</p>
      <p className="mb-1 font-mono text-2xl font-bold text-card-foreground break-words">{value}</p>
      <p className="text-xs text-muted-foreground">{subtitle}</p>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 border-b border-border/60 pb-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold text-card-foreground sm:text-right">{value}</span>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { Clock3, Database, Download, MapPin, Waves } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { SkeletonLoader } from './SkeletonLoader';

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

export function Dashboard() {
  const [isLoading, setIsLoading] = useState(true);
  const [datasets, setDatasets] = useState<Array<{ id: string; name: string }>>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch('/api/meta');
        const data = await response.json();
        if (response.ok) {
          setDatasets(data.datasets || []);
        }
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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <MetricCard icon={Database} title="Datasets disponibles" value={String(datasets.length)} subtitle="Catalogo operativo" />
        <MetricCard icon={Download} title="Filas descargadas" value={totals.rows.toLocaleString('es-CO')} subtitle={`${history.length} ejecuciones`} />
        <MetricCard icon={MapPin} title="Estaciones procesadas" value={totals.stations.toLocaleString('es-CO')} subtitle="Suma del historial local" />
        <MetricCard icon={Clock3} title="Tiempo medio" value={`${totals.avgTimeMs} ms`} subtitle="Promedio por descarga" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-xl p-6 shadow-[0_0_40px_rgba(201,162,39,0.1)]">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-card-foreground font-bold">Rendimiento reciente</h3>
              <p className="text-muted-foreground text-sm">Filas y estaciones por ejecucion</p>
            </div>
            <Waves className="w-5 h-5 text-accent" />
          </div>
          <div style={{ width: '100%', height: '260px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData.length ? chartData : [{ label: '—', filas: 0, estaciones: 0 }]}>
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

        <div className="bg-card border border-border rounded-xl p-6 shadow-[0_0_40px_rgba(201,162,39,0.1)]">
          <h3 className="text-card-foreground font-bold mb-4">Impacto visible</h3>
          <div className="space-y-4 text-sm">
            <SummaryRow label="Ultima ejecucion" value={history[0]?.timestamp || 'Sin registros'} />
            <SummaryRow label="Tiempo total acumulado" value={`${totals.timeMs.toLocaleString('es-CO')} ms`} />
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

      <div className="bg-card border border-border rounded-xl p-6 shadow-[0_0_40px_rgba(201,162,39,0.1)]">
        <h3 className="text-card-foreground font-bold mb-4">Descargas recientes</h3>
        {isLoading ? (
          <SkeletonLoader rows={3} />
        ) : history.length === 0 ? (
          <p className="text-muted-foreground">Todavia no hay descargas registradas en este navegador.</p>
        ) : (
          <div className="space-y-3">
            {history.slice(0, 5).map((item, index) => (
              <div key={`${item.fileName}-${index}`} className="flex items-center justify-between rounded-lg border border-border bg-background p-4">
                <div>
                  <p className="text-card-foreground font-semibold">{item.variable}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.rowCount.toLocaleString('es-CO')} filas · {item.stationCount} estaciones · {item.municipalityCount} municipios
                  </p>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <p>{item.format.toUpperCase()}</p>
                  <p>{item.processingMs} ms</p>
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
    <div className="bg-card border border-border rounded-xl p-6 shadow-[0_0_20px] shadow-accent/10">
      <div className="flex items-start justify-between mb-4">
        <Icon className="w-7 h-7 text-accent" />
      </div>
      <p className="text-muted-foreground text-sm mb-1">{title}</p>
      <p className="text-card-foreground font-mono text-2xl font-bold mb-1">{value}</p>
      <p className="text-muted-foreground text-xs">{subtitle}</p>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/60 pb-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-semibold text-card-foreground">{value}</span>
    </div>
  );
}

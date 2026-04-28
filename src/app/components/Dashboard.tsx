import { useEffect, useMemo, useState } from 'react';
import { Clock, Database, HardDrive, MapPin, TrendingUp } from 'lucide-react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { SkeletonLoader } from './SkeletonLoader';

const sparklineData = [
  { id: 1, value: 120 },
  { id: 2, value: 156 },
  { id: 3, value: 99 },
  { id: 4, value: 223 },
  { id: 5, value: 195 },
  { id: 6, value: 78 },
  { id: 7, value: 45 },
];

interface HistoryEntry {
  timestamp: string;
  variable: string;
  department: string;
  municipality: string;
  format: string;
  rowCount: number;
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
        setTimeout(() => setIsLoading(false), 600);
      }
    };
    void load();
  }, []);

  const totalRows = useMemo(
    () => history.reduce((sum, item) => sum + Number(item.rowCount || 0), 0),
    [history]
  );

  const activityData = useMemo(
    () =>
      history
        .slice(0, 7)
        .map((item, index) => ({
          id: index + 1,
          day: item.timestamp.slice(0, 10),
          descargas: Number(item.rowCount || 0),
          mb: Math.max(1, Math.round(Number(item.rowCount || 0) / 5000)),
        }))
        .reverse(),
    [history]
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <MetricCard
          icon={Database}
          title="Datasets Disponibles"
          value={String(datasets.length)}
          subtitle="Catálogo operativo"
          trend={datasets.length ? 'API online' : 'Cargando'}
          color="auburn"
        />
        <MetricCard
          icon={HardDrive}
          title="Filas Descargadas"
          value={totalRows.toLocaleString('es-CO')}
          subtitle="Historial local"
          trend={`${history.length} descargas`}
          color="gold"
        />
        <MetricCard
          icon={Clock}
          title="Última Ejecución"
          value={history[0]?.timestamp || 'Sin datos'}
          subtitle="Registro más reciente"
          trend={history.length ? 'Activo' : 'Sin uso'}
          color="green"
          compact
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-xl p-6 shadow-[0_0_40px_rgba(201,162,39,0.1)] hover:border-accent/30 transition-all duration-300">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-card-foreground font-bold">Actividad de Descargas</h3>
              <p className="text-muted-foreground text-sm">Últimos registros locales</p>
            </div>
            <TrendingUp className="w-5 h-5 text-success" />
          </div>
          <div style={{ width: '100%', height: '250px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={activityData.length ? activityData : [{ day: '—', descargas: 0 }]}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border" />
                <XAxis dataKey="day" stroke="currentColor" className="text-muted-foreground" style={{ fontSize: '12px' }} />
                <YAxis stroke="currentColor" className="text-muted-foreground" style={{ fontSize: '12px' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--background)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    color: 'var(--foreground)',
                  }}
                />
                <Bar dataKey="descargas" fill="var(--primary)" radius={[8, 8, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 shadow-[0_0_40px_rgba(201,162,39,0.1)] hover:border-accent/30 transition-all duration-300">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-card-foreground font-bold">Cobertura Territorial</h3>
              <p className="text-muted-foreground text-sm">Departamentos configurados</p>
            </div>
            <MapPin className="w-5 h-5 text-accent" />
          </div>
          <div className="relative h-[250px] bg-background rounded-lg border border-border overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent/10" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="relative inline-block">
                  <MapPin className="w-16 h-16 text-accent/30 mx-auto mb-4" />
                  <div className="absolute -top-2 -right-2 w-6 h-6 bg-accent rounded-full flex items-center justify-center text-accent-foreground text-xs font-bold">
                    32
                  </div>
                </div>
                <p className="text-muted-foreground text-sm mb-1">Mapa lógico de cobertura</p>
                <p className="text-card-foreground text-xs font-mono">Validación por variantes territoriales</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-6 shadow-[0_0_40px_rgba(201,162,39,0.1)]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-card-foreground font-bold">Descargas Recientes</h3>
          <div style={{ width: '128px', height: '48px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sparklineData}>
                <defs>
                  <linearGradient id="sparkGradientUnique" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="value" stroke="var(--accent)" strokeWidth={2} fill="url(#sparkGradientUnique)" isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        {isLoading ? (
          <SkeletonLoader rows={3} />
        ) : history.length === 0 ? (
          <p className="text-muted-foreground">Todavía no hay descargas registradas en este navegador.</p>
        ) : (
          <div className="space-y-3">
            {history.slice(0, 5).map((item, index) => (
              <div key={`${item.fileName}-${index}`} className="flex items-center justify-between p-4 bg-background rounded-lg border border-border hover:border-accent/50 transition-all">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center border border-primary/30">
                    <Database className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-card-foreground font-mono text-sm font-semibold">{item.variable}</p>
                    <p className="text-muted-foreground text-xs">{item.department} · {item.municipality}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-card-foreground font-mono text-sm">{Number(item.rowCount || 0).toLocaleString('es-CO')} registros</p>
                  <p className="text-muted-foreground text-xs">{item.format.toUpperCase()} · {item.timestamp}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface MetricCardProps {
  icon: React.ElementType;
  title: string;
  value: string;
  subtitle: string;
  trend: string;
  color: 'auburn' | 'gold' | 'green';
  compact?: boolean;
}

function MetricCard({ icon: Icon, title, value, subtitle, trend, color, compact }: MetricCardProps) {
  const colorClasses = {
    auburn: 'from-primary/20 to-primary/5 text-primary shadow-[0_0_30px] shadow-primary/20 hover:shadow-[0_0_40px] hover:shadow-primary/30',
    gold: 'from-accent/20 to-accent/5 text-accent shadow-[0_0_30px] shadow-accent/20 hover:shadow-[0_0_40px] hover:shadow-accent/30',
    green: 'from-success/20 to-success/5 text-success shadow-[0_0_30px] shadow-success/20 hover:shadow-[0_0_40px] hover:shadow-success/30',
  };

  return (
    <div className={`bg-gradient-to-br ${colorClasses[color]} border border-border rounded-xl p-6 transition-all duration-300 hover:scale-[1.02]`}>
      <div className="flex items-start justify-between mb-4">
        <Icon className="w-8 h-8" />
        <span className="text-xs px-2 py-1 bg-background rounded-md font-mono">{trend}</span>
      </div>
      <div>
        <p className="text-muted-foreground text-sm mb-1">{title}</p>
        <p className={`text-card-foreground font-mono mb-1 ${compact ? 'text-base' : 'text-3xl'}`}>{value}</p>
        <p className="text-muted-foreground text-xs">{subtitle}</p>
      </div>
    </div>
  );
}

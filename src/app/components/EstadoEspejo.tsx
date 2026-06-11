import { useEffect, useMemo, useState } from 'react';
import { Activity, CheckCircle2, Clock3, Database, RefreshCw, XCircle } from 'lucide-react';
import { SkeletonLoader } from './SkeletonLoader';
import { apiJson } from '../lib/ideamApi';
import type {
  AnalyticsDatasetOverview,
  AnalyticsDatasetsOverviewResponse,
  DataFreshness,
  MetaResponse,
} from '../../shared/ideamContracts';

type GlobalState = 'ok' | 'degraded' | 'down' | 'loading';

function hoursSince(iso: string | null) {
  if (!iso) return null;
  const elapsed = Date.now() - new Date(iso).getTime();
  return Number.isFinite(elapsed) && elapsed >= 0 ? elapsed / 3_600_000 : null;
}

function formatDateTime(iso: string | null) {
  if (!iso) return 'Sin datos';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? 'Sin datos' : date.toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' });
}

export function EstadoEspejo() {
  const [freshness, setFreshness] = useState<DataFreshness | null>(null);
  const [datasets, setDatasets] = useState<AnalyticsDatasetOverview[]>([]);
  const [apiOk, setApiOk] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const results = await Promise.allSettled([
        apiJson<{ ok?: boolean }>('/api/health', undefined, 'Sin salud.'),
        apiJson<MetaResponse>('/api/meta', undefined, 'Sin metadata.'),
        apiJson<AnalyticsDatasetsOverviewResponse>('/api/analytics/datasets-overview', undefined, 'Sin overview.'),
      ]);
      if (cancelled) return;
      setApiOk(results[0].status === 'fulfilled');
      if (results[1].status === 'fulfilled') setFreshness(results[1].value.dataFreshness || null);
      if (results[2].status === 'fulfilled') setDatasets(results[2].value.datasets || []);
      setIsLoading(false);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const totalRows = useMemo(() => datasets.reduce((sum, d) => sum + d.rowCount, 0), [datasets]);
  const totalStations = useMemo(() => datasets.reduce((sum, d) => sum + d.stationCount, 0), [datasets]);

  // El delta corre 2x/día: <14h verde, <26h ámbar (perdió una corrida), rojo después.
  const syncAgeHours = hoursSince(freshness?.lastSync ?? null);
  const globalState: GlobalState = isLoading
    ? 'loading'
    : !apiOk
      ? 'down'
      : syncAgeHours === null || syncAgeHours > 26
        ? 'degraded'
        : 'ok';

  const stateUi: Record<GlobalState, { label: string; classes: string; Icon: typeof CheckCircle2 }> = {
    ok: { label: 'Operativo y al día', classes: 'border-success/40 bg-success/10 text-success', Icon: CheckCircle2 },
    degraded: { label: 'Operativo, sincronización atrasada', classes: 'border-accent/40 bg-accent/10 text-accent', Icon: Clock3 },
    down: { label: 'Servicio con problemas', classes: 'border-destructive/40 bg-destructive/10 text-destructive', Icon: XCircle },
    loading: { label: 'Consultando estado...', classes: 'border-border bg-card text-muted-foreground', Icon: RefreshCw },
  };
  const { label, classes, Icon } = stateUi[globalState];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-card-foreground text-2xl font-bold">Estado del espejo de datos</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Transparencia operativa: qué tan completo y qué tan fresco está el espejo propio de los datos abiertos del IDEAM.
        </p>
      </div>

      <div className={`flex items-center gap-3 rounded-xl border px-5 py-4 ${classes}`}>
        <Icon className="h-6 w-6 shrink-0" />
        <div>
          <p className="font-bold">{label}</p>
          <p className="text-xs opacity-80">
            Última sincronización: {formatDateTime(freshness?.lastSync ?? null)} · Dato más reciente:{' '}
            {formatDateTime(freshness?.latestObservation ?? null)} · El espejo se sincroniza con datos.gov.co dos veces al día.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        <StatCard icon={Database} title="Observaciones en el espejo" value={totalRows.toLocaleString('es-CO')} />
        <StatCard icon={Activity} title="Variables (datasets IDEAM)" value={String(datasets.length)} />
        <StatCard icon={RefreshCw} title="Estaciones con datos" value={totalStations.toLocaleString('es-CO')} />
      </div>

      <div className="rounded-xl border border-border bg-card p-6 shadow-glow">
        <h3 className="mb-4 font-bold text-card-foreground">Detalle por variable</h3>
        {isLoading ? (
          <SkeletonLoader rows={5} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-4 font-semibold">Variable</th>
                  <th className="py-2 pr-4 text-right font-semibold">Observaciones</th>
                  <th className="py-2 pr-4 text-right font-semibold">Estaciones</th>
                  <th className="py-2 pr-4 text-right font-semibold">Desde</th>
                  <th className="py-2 text-right font-semibold">Hasta</th>
                </tr>
              </thead>
              <tbody>
                {datasets.map((dataset) => (
                  <tr key={dataset.id} className="border-b border-border/60">
                    <td className="py-2.5 pr-4 font-semibold text-card-foreground">{dataset.name}</td>
                    <td className="py-2.5 pr-4 text-right font-mono text-card-foreground">{dataset.rowCount.toLocaleString('es-CO')}</td>
                    <td className="py-2.5 pr-4 text-right font-mono text-card-foreground">{dataset.stationCount.toLocaleString('es-CO')}</td>
                    <td className="py-2.5 pr-4 text-right text-muted-foreground">{dataset.firstObservation?.slice(0, 7) || 'N/D'}</td>
                    <td className="py-2.5 text-right text-muted-foreground">{dataset.lastObservation?.slice(0, 7) || 'N/D'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Fuente original: IDEAM vía datos abiertos de Colombia (datos.gov.co). Este espejo existe para consultas y analítica
        sub-segundo; ante cualquier discrepancia, la fuente oficial prevalece.
      </p>
    </div>
  );
}

function StatCard({ icon: Icon, title, value }: { icon: React.ElementType; title: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-[0_0_20px] shadow-accent/10">
      <Icon className="mb-3 h-6 w-6 text-accent" />
      <p className="text-sm text-muted-foreground">{title}</p>
      <p className="mt-1 font-mono text-2xl font-bold text-card-foreground break-words">{value}</p>
    </div>
  );
}

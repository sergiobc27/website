import { useEffect, useMemo, useState } from 'react';
import { Calendar, Clock3, Database, Download, MapPin, Trash2 } from 'lucide-react';
import { fmt } from '../lib/format';

const HISTORY_KEY = 'ideam-history';
const PRODUCTION_API_ORIGIN = 'https://ideam.sergiobc.com';

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
  downloadPath?: string;
  availableUntil?: string;
}

function readHistory(): HistoryEntry[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  } catch {
    return [];
  }
}

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '0 B';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${fmt(value / 1024, 1)} KB`;
  return `${fmt(value / (1024 * 1024), 2)} MB`;
}

function formatDuration(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '0 s';
  if (value < 60000) return `${fmt(value / 1000, value < 10000 ? 1 : 0)} s`;
  const totalSeconds = Math.round(value / 1000);
  return `${Math.floor(totalSeconds / 60)}m ${String(totalSeconds % 60).padStart(2, '0')}s`;
}

function apiUrl(path: string) {
  if (path.startsWith('http')) return path;
  if (typeof window === 'undefined') return path;
  return window.location.hostname === 'ideam.sergiobc.com' ? path : `${PRODUCTION_API_ORIGIN}${path}`;
}

function canDownloadAgain(item: HistoryEntry) {
  if (!item.downloadPath || !item.availableUntil) return false;
  const expiresAt = new Date(item.availableUntil).valueOf();
  return Number.isFinite(expiresAt) && expiresAt > Date.now();
}

export function DownloadHistory() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [downloadError, setDownloadError] = useState('');

  useEffect(() => {
    setHistory(readHistory());
  }, []);

  const stats = useMemo(() => {
    const totalRows = history.reduce((sum, item) => sum + (item.rowCount || 0), 0);
    const totalStations = history.reduce((sum, item) => sum + (item.stationCount || 0), 0);
    const totalTime = history.reduce((sum, item) => sum + (item.processingMs || 0), 0);
    return {
      downloads: history.length,
      rows: totalRows,
      stations: totalStations,
      avgTime: history.length ? Math.round(totalTime / history.length) : 0,
      latest: history[0]?.timestamp || 'Sin registros',
    };
  }, [history]);

  const clearHistory = () => {
    localStorage.removeItem(HISTORY_KEY);
    setHistory([]);
  };

  const downloadHistoryItem = async (item: HistoryEntry) => {
    if (!item.downloadPath) return;
    setDownloadError('');
    // Sonda HEAD: el reloj local puede estar desfasado del expiresAt del
    // servidor; si el ZIP ya no existe (410/404), aviso dentro de la app.
    try {
      const probe = await fetch(apiUrl(item.downloadPath), { method: 'HEAD', cache: 'no-store' });
      if (probe.status === 410 || probe.status === 404) {
        setDownloadError(`"${item.fileName}" expiro en el servidor (la ventana es de 1 hora). Genera una nueva exportacion desde el Extractor.`);
        return;
      }
    } catch {
      // Sonda fallida por red: se intenta la descarga de todas formas.
    }
    const link = document.createElement('a');
    link.href = apiUrl(item.downloadPath);
    link.download = item.fileName;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-card-foreground">Historial de descargas</h2>
          <p className="mt-1 text-sm text-muted-foreground">Registro local con volumen, tiempo, estaciones y cobertura procesada</p>
        </div>
        <button
          onClick={clearHistory}
          className="flex items-center justify-center gap-2 rounded-lg border border-transparent bg-muted px-4 py-2 font-semibold text-muted-foreground transition-all hover:border-destructive/30 hover:bg-destructive/15 hover:text-destructive sm:w-auto"
          type="button"
        >
          <Trash2 className="h-4 w-4" />
          Limpiar
        </button>
      </div>

      {downloadError && (
        <div role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {downloadError}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard title="Descargas" value={String(stats.downloads)} icon={Download} />
        <StatCard title="Filas" value={stats.rows.toLocaleString('es-CO')} icon={Database} />
        <StatCard title="Estaciones" value={stats.stations.toLocaleString('es-CO')} icon={MapPin} />
        <StatCard title="Tiempo medio" value={formatDuration(stats.avgTime)} icon={Clock3} />
        <StatCard title="Ultima ejecucion" value={stats.latest} icon={Calendar} compact />
      </div>

      {history.length > 0 && (
        <div className="space-y-3 md:hidden">
          {history.map((item, index) => {
            const isAvailable = canDownloadAgain(item);
            return (
            <div key={`${item.fileName}-${index}`} className="rounded-xl border border-border bg-card p-4 shadow-[0_0_20px] shadow-accent/5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-card-foreground">{item.variable}</p>
                  <p className="mt-1 break-words font-mono text-xs text-muted-foreground">{item.fileName}</p>
                </div>
                <span className="shrink-0 text-xs font-semibold text-muted-foreground">{item.format.toUpperCase()}</span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <MiniStat label="Filas" value={Number(item.rowCount || 0).toLocaleString('es-CO')} />
                <MiniStat label="Estaciones" value={Number(item.stationCount || 0).toLocaleString('es-CO')} />
                <MiniStat label="Municipios" value={Number(item.municipalityCount || 0).toLocaleString('es-CO')} />
                <MiniStat label="Zonas" value={Number(item.zoneCount || 0).toLocaleString('es-CO')} />
                <MiniStat label="Tiempo" value={formatDuration(item.processingMs)} />
                <MiniStat label="Peso" value={formatBytes(item.sizeBytes || 0)} />
              </div>
              <div className="mt-4 flex flex-col gap-3">
                <p className="text-xs text-muted-foreground">{item.timestamp}</p>
                {isAvailable ? (
                  <button
                    type="button"
                    onClick={() => downloadHistoryItem(item)}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-sm font-semibold text-accent hover:bg-accent/15"
                  >
                    <Download className="h-4 w-4" />
                    Descargar ZIP
                  </button>
                ) : (
                  <p className="text-xs text-muted-foreground">ZIP temporal expirado</p>
                )}
              </div>
            </div>
          );
          })}
        </div>
      )}

      <div className="hidden overflow-hidden rounded-xl border border-border bg-card shadow-[0_0_40px_rgba(201,162,39,0.1)] md:block">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-border bg-background">
              <tr>
                <th className="p-4 text-left text-sm font-bold text-muted-foreground">Variable</th>
                <th className="p-4 text-left text-sm font-bold text-muted-foreground">Filas</th>
                <th className="p-4 text-left text-sm font-bold text-muted-foreground">Estaciones</th>
                <th className="p-4 text-left text-sm font-bold text-muted-foreground">Municipios</th>
                <th className="p-4 text-left text-sm font-bold text-muted-foreground">Zonas</th>
                <th className="p-4 text-left text-sm font-bold text-muted-foreground">Tiempo</th>
                <th className="p-4 text-left text-sm font-bold text-muted-foreground">Peso</th>
                <th className="p-4 text-left text-sm font-bold text-muted-foreground">Archivo</th>
                <th className="p-4 text-left text-sm font-bold text-muted-foreground">Descarga</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-muted-foreground">
                    Aún no hay descargas registradas en este navegador.
                  </td>
                </tr>
              ) : (
                history.map((item, index) => {
                  const isAvailable = canDownloadAgain(item);
                  return (
                    <tr
                      key={`${item.fileName}-${index}`}
                      className={`border-b border-border transition-all hover:bg-muted/50 ${index % 2 === 0 ? 'bg-card' : 'bg-background'}`}
                    >
                      <td className="p-4 font-semibold text-card-foreground">{item.variable}</td>
                      <td className="p-4 font-mono text-sm font-bold text-card-foreground">{Number(item.rowCount || 0).toLocaleString('es-CO')}</td>
                      <td className="p-4 text-sm text-muted-foreground">{Number(item.stationCount || 0).toLocaleString('es-CO')}</td>
                      <td className="p-4 text-sm text-muted-foreground">{Number(item.municipalityCount || 0).toLocaleString('es-CO')}</td>
                      <td className="p-4 text-sm text-muted-foreground">{Number(item.zoneCount || 0).toLocaleString('es-CO')}</td>
                      <td className="p-4 font-mono text-sm text-card-foreground">{formatDuration(item.processingMs)}</td>
                      <td className="p-4 text-sm text-muted-foreground">{formatBytes(item.sizeBytes || 0)}</td>
                      <td className="p-4 font-mono text-sm text-muted-foreground">{item.fileName}</td>
                      <td className="p-4 text-xs text-muted-foreground">
                        <div className="mb-2 font-mono">{item.format.toUpperCase()}</div>
                        {isAvailable ? (
                          <button
                            type="button"
                            onClick={() => downloadHistoryItem(item)}
                            className="inline-flex items-center gap-2 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 font-semibold text-accent hover:bg-accent/15"
                          >
                            <Download className="h-4 w-4" />
                            Descargar
                          </button>
                        ) : (
                          <div>Expirado</div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon: Icon,
  compact,
}: {
  title: string;
  value: string;
  icon: React.ElementType;
  compact?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-[0_0_20px] shadow-accent/5 transition-all hover:border-accent/50 hover:shadow-[0_0_30px] hover:shadow-accent/15">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-primary/30 bg-primary/20">
          <Icon className="h-5 w-5 text-accent" />
        </div>
      </div>
      <p className={`mb-1 font-mono font-bold text-card-foreground break-words ${compact ? 'text-sm' : 'text-2xl'}`}>{value}</p>
      <p className="text-xs font-semibold text-muted-foreground">{title}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold text-card-foreground break-words">{value}</p>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { Calendar, Database, Download, FileText, Trash2 } from 'lucide-react';

const HISTORY_KEY = 'ideam-history';

interface HistoryEntry {
  timestamp: string;
  variable: string;
  department: string;
  municipality: string;
  format: string;
  rowCount: number;
  fileName: string;
}

function readHistory(): HistoryEntry[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  } catch {
    return [];
  }
}

export function DownloadHistory() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(readHistory());
  }, []);

  const stats = useMemo(() => {
    const totalRows = history.reduce((sum, item) => sum + (item.rowCount || 0), 0);
    return {
      downloads: history.length,
      rows: totalRows,
      formats: new Set(history.map((item) => item.format.toUpperCase())).size,
      latest: history[0]?.timestamp || 'Sin registros',
    };
  }, [history]);

  const clearHistory = () => {
    localStorage.removeItem(HISTORY_KEY);
    setHistory([]);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-card-foreground text-2xl font-bold">Historial de Descargas</h2>
          <p className="text-muted-foreground text-sm mt-1">Registro local de archivos descargados desde la app</p>
        </div>
        <button
          onClick={clearHistory}
          className="flex items-center gap-2 px-4 py-2 bg-muted text-muted-foreground rounded-lg hover:bg-destructive/15 hover:text-destructive border border-transparent hover:border-destructive/30 transition-all font-semibold"
        >
          <Trash2 className="w-4 h-4" />
          Limpiar
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard title="Total Descargas" value={String(stats.downloads)} icon={Download} />
        <StatCard title="Registros Totales" value={stats.rows.toLocaleString('es-CO')} icon={Database} />
        <StatCard title="Formatos Usados" value={String(stats.formats)} icon={FileText} />
        <StatCard title="Última Ejecución" value={stats.latest} icon={Calendar} compact />
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-[0_0_40px_rgba(201,162,39,0.1)]">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-background border-b border-border">
              <tr>
                <th className="text-left p-4 text-muted-foreground text-sm font-bold">Variable</th>
                <th className="text-left p-4 text-muted-foreground text-sm font-bold">Departamento</th>
                <th className="text-left p-4 text-muted-foreground text-sm font-bold">Municipio</th>
                <th className="text-left p-4 text-muted-foreground text-sm font-bold">Formato</th>
                <th className="text-left p-4 text-muted-foreground text-sm font-bold">Registros</th>
                <th className="text-left p-4 text-muted-foreground text-sm font-bold">Archivo</th>
                <th className="text-left p-4 text-muted-foreground text-sm font-bold">Descarga</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    Aún no hay descargas registradas en este navegador.
                  </td>
                </tr>
              ) : (
                history.map((item, index) => (
                  <tr
                    key={`${item.fileName}-${index}`}
                    className={`border-b border-border hover:bg-muted/50 transition-all ${index % 2 === 0 ? 'bg-card' : 'bg-background'}`}
                  >
                    <td className="p-4 text-card-foreground font-semibold">{item.variable}</td>
                    <td className="p-4 text-muted-foreground text-sm">{item.department}</td>
                    <td className="p-4 text-muted-foreground text-sm">{item.municipality}</td>
                    <td className="p-4">
                      <span className="px-2 py-1 rounded text-xs font-mono font-bold bg-accent/20 text-accent border border-accent/30">
                        {item.format.toUpperCase()}
                      </span>
                    </td>
                    <td className="p-4 text-card-foreground font-mono text-sm font-bold">
                      {Number(item.rowCount || 0).toLocaleString('es-CO')}
                    </td>
                    <td className="p-4 text-muted-foreground text-sm font-mono">{item.fileName}</td>
                    <td className="p-4 text-muted-foreground text-xs font-mono">{item.timestamp}</td>
                  </tr>
                ))
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
    <div className="bg-card border border-border rounded-xl p-4 hover:border-accent/50 hover:shadow-[0_0_30px] hover:shadow-accent/15 transition-all shadow-[0_0_20px] shadow-accent/5">
      <div className="flex items-center justify-between mb-2">
        <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center border border-primary/30">
          <Icon className="w-5 h-5 text-accent" />
        </div>
      </div>
      <p className={`text-card-foreground font-mono font-bold mb-1 ${compact ? 'text-sm' : 'text-2xl'}`}>{value}</p>
      <p className="text-muted-foreground text-xs font-semibold">{title}</p>
    </div>
  );
}

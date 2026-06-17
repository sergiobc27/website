import type { DownloadMetrics } from '../../shared/ideamContracts';

// Fuente única del historial local de descargas (antes duplicado entre
// DataExtractor.tsx y DownloadHistory.tsx).
export const HISTORY_KEY = 'ideam-history';

export interface HistoryEntry extends DownloadMetrics {
  timestamp: string;
  variable: string;
  format: string;
  departments?: string[];
  catalogFilters?: Record<string, string[]>;
  jobId?: string;
  downloadPath?: string;
  availableUntil?: string;
}

export function readHistory(): HistoryEntry[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  } catch {
    return [];
  }
}

export function saveHistory(entry: HistoryEntry) {
  const history = readHistory();
  // Dedup por jobId: una recarga (o 2 pestañas) en la ventana de carrera del
  // finalize creaba entradas duplicadas del mismo export (auditoría #4).
  const deduped = entry.jobId ? history.filter((item) => item.jobId !== entry.jobId) : history;
  deduped.unshift(entry);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(deduped.slice(0, 30)));
}

// ¿El ZIP temporal sigue dentro de su ventana de 1 hora?
export function canDownloadAgain(item: HistoryEntry): boolean {
  if (!item.downloadPath || !item.availableUntil) return false;
  const expiresAt = new Date(item.availableUntil).valueOf();
  return Number.isFinite(expiresAt) && expiresAt > Date.now();
}

// Deriva una vista de progreso "honesta" a partir del job que el backend ya emite.
// Principios: barra DETERMINADA cuando hay datos reales; spinner solo en planeación;
// porcentaje monótono creciente (clamp, nunca baja); ETA en rango amable.

export type FaseDescarga = 'planear' | 'descargar' | 'empacar' | 'listo' | 'error';

export interface ProgresoVista {
  fase: FaseDescarga;
  percent: number; // 0-100, monótono creciente respecto a prevPercent
  indeterminado: boolean; // true => spinner; false => barra determinada
}

interface JobLike {
  status?: string;
  progressPercent?: number;
  currentPage?: number;
  totalPages?: number;
  currentStage?: string;
}

export function derivarProgreso(job: JobLike | null | undefined, prevPercent = 0): ProgresoVista {
  const s = job?.status ?? 'queued';
  if (s === 'failed') return { fase: 'error', percent: prevPercent, indeterminado: false };
  if (s === 'completed') return { fase: 'listo', percent: 100, indeterminado: false };
  if (s === 'queued' || s === 'planning') return { fase: 'planear', percent: prevPercent, indeterminado: true };
  // processing / retrying / packing
  const empacando = /pack|empac|zip|compress/i.test(job?.currentStage ?? '');
  const raw =
    typeof job?.progressPercent === 'number'
      ? job.progressPercent
      : job?.totalPages
        ? ((job.currentPage ?? 0) / job.totalPages) * 100
        : prevPercent;
  const percent = Math.min(100, Math.max(prevPercent, Math.round(raw))); // clamp monótono
  return { fase: empacando ? 'empacar' : 'descargar', percent, indeterminado: false };
}

/** Media móvil exponencial del throughput. `prev=null` arranca con `actual`. */
export function emaSiguiente(prev: number | null, actual: number, alpha = 0.25): number {
  if (prev == null || !Number.isFinite(prev)) return actual;
  return Math.round(alpha * actual + (1 - alpha) * prev);
}

/**
 * Histéresis del ETA: conserva el valor mostrado si el nuevo cambia menos del
 * umbral (evita el parpadeo "5 min → 2 min → 7 min").
 */
export function etaEstableSeg(prevShown: number | null, nuevo: number, umbral = 0.1): number {
  if (prevShown == null || prevShown <= 0) return nuevo;
  return Math.abs(nuevo - prevShown) / prevShown < umbral ? prevShown : nuevo;
}

/** ETA en rango amable (sesgo a sobreestimar). Devuelve '' si no hay dato útil. */
export function etaAmable(segundos: number | null | undefined): string {
  if (segundos == null || !Number.isFinite(segundos) || segundos <= 0) return '';
  if (segundos < 15) return 'unos segundos';
  if (segundos < 45) return 'menos de 1 minuto';
  const min = Math.ceil(segundos / 60);
  return `~${min} min`;
}

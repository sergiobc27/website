// Lógica pura del dashboard bento (testeable sin DOM ni red).
// OJO unidades: la serie mensual nacional usa metric 'avg' = mm POR OBSERVACIÓN
// de 10 minutos (~0,05). Estas funciones son agnósticas a la unidad; la capa de
// presentación convierte a intensidad (mm/h = valor × 6) para mostrar.
import type { AnalyticsDatasetOverview, AnalyticsTimeseriesPoint } from '../../shared/ideamContracts';

export function sumarObservaciones(datasets: AnalyticsDatasetOverview[]): number | null {
  if (!datasets.length) return null;
  return datasets.reduce((s, d) => s + (Number(d.rowCount) || 0), 0);
}

const MES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export function ultimosMeses(points: AnalyticsTimeseriesPoint[], n: number) {
  return points
    .filter((p) => p.value !== null)
    .slice(-n)
    .map((p) => ({
      etiqueta: `${MES_CORTO[Number(p.bucket.slice(5, 7)) - 1]} ${p.bucket.slice(2, 4)}`,
      valor: p.value as number,
    }));
}

export interface FilaCalendario {
  anio: number;
  meses: Array<number | null>;
}

export function matrizCalendario(points: AnalyticsTimeseriesPoint[]): { anios: FilaCalendario[]; max: number } {
  const porAnio = new Map<number, Array<number | null>>();
  let max = 0;
  for (const p of points) {
    if (p.value === null) continue;
    const anio = Number(p.bucket.slice(0, 4));
    const mes = Number(p.bucket.slice(5, 7)) - 1;
    if (!porAnio.has(anio)) porAnio.set(anio, new Array(12).fill(null));
    porAnio.get(anio)![mes] = p.value;
    if (p.value > max) max = p.value;
  }
  const anios = [...porAnio.entries()].sort((a, b) => a[0] - b[0]).map(([anio, meses]) => ({ anio, meses }));
  return { anios, max };
}

// Escala institucional CUC: oro pálido (seco) → rojo CUC profundo (lluvioso).
// Endpoints de marca: oro #C9A227 (~hue 43) y rojo #A3161A (~hue 358).
// Interpolación en HSL recorriendo oro → naranja → rojo.
export function colorCalendario(valor: number | null, max: number): string {
  if (valor === null || !Number.isFinite(valor) || max <= 0) return 'transparent';
  const t = Math.max(0, Math.min(1, valor / max));
  const hue = (43 - t * 45 + 360) % 360; // oro (43) → rojo CUC (358)
  const sat = 65 + t * 11; // 65% → 76%
  const luz = 90 - t * 54; // pálido (seco) → rojo profundo (lluvioso)
  return `hsl(${Math.round(hue)} ${Math.round(sat)}% ${Math.round(luz)}%)`;
}

export function mesVsHistorico(
  actual: AnalyticsTimeseriesPoint | null,
  climatologia: Array<{ month: number; mean: number | null }>,
): { pct: number; direccion: 'arriba' | 'abajo' } | null {
  if (!actual || actual.value === null) return null;
  const mes = Number(actual.bucket.slice(5, 7));
  const ref = climatologia.find((c) => c.month === mes);
  if (!ref || ref.mean === null || ref.mean === 0) return null;
  const pct = Math.round(((actual.value - ref.mean) / ref.mean) * 100);
  return { pct: Math.abs(pct), direccion: pct >= 0 ? 'arriba' : 'abajo' };
}

export function frescuraRelativa(iso: string | null, ahora = Date.now()): string {
  if (!iso) return '';
  const elapsedMs = ahora - new Date(iso).getTime();
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return '';
  const minutes = Math.round(elapsedMs / 60000);
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `hace ${hours} h`;
  return `hace ${Math.round(hours / 24)} días`;
}

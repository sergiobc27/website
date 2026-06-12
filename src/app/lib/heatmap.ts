// Constructores de matriz para el heatmap climático. Lógica pura, sin DOM.
// Reusa la paleta CUC y la matriz años×meses ya existentes en dashboard.ts.
import type { AnalyticsTimeseriesPoint } from '../../shared/ideamContracts';
import { colorCalendario, matrizCalendario } from './dashboard';

export { colorCalendario };
export const matrizAniosMeses = matrizCalendario;

export interface Dia {
  fecha: string; // YYYY-MM-DD
  valor: number | null;
}

// Día de semana con lunes=0 ... domingo=6 (estándar ISO/Colombia).
function diaSemanaLunes(utcMs: number): number {
  return (new Date(utcMs).getUTCDay() + 6) % 7;
}

export function matrizUnAnioMeses(
  points: AnalyticsTimeseriesPoint[],
  anio: number,
): { meses: Array<number | null>; max: number } {
  const meses: Array<number | null> = new Array(12).fill(null);
  let max = 0;
  for (const pt of points) {
    if (pt.value === null) continue;
    if (!pt.bucket.startsWith(`${anio}-`)) continue;
    const mes = Number(pt.bucket.slice(5, 7)) - 1;
    if (mes < 0 || mes > 11) continue;
    meses[mes] = pt.value;
    if (pt.value > max) max = pt.value;
  }
  return { meses, max };
}

export function matrizDiasSemana(
  points: AnalyticsTimeseriesPoint[],
  anio: number,
): { columnas: Array<Array<Dia | null>>; max: number } {
  const valorPorFecha = new Map<string, number>();
  let max = 0;
  for (const pt of points) {
    if (pt.value === null || !pt.bucket.startsWith(`${anio}-`)) continue;
    valorPorFecha.set(pt.bucket.slice(0, 10), pt.value);
    if (pt.value > max) max = pt.value;
  }
  const inicio = Date.UTC(anio, 0, 1);
  const fin = Date.UTC(anio, 11, 31);
  const offsetInicial = diaSemanaLunes(inicio); // filas null antes de Jan 1
  const columnas: Array<Array<Dia | null>> = [];
  let col: Array<Dia | null> = new Array(offsetInicial).fill(null);
  for (let t = inicio; t <= fin; t += 86400000) {
    const fecha = new Date(t).toISOString().slice(0, 10);
    col.push({ fecha, valor: valorPorFecha.has(fecha) ? valorPorFecha.get(fecha)! : null });
    if (col.length === 7) {
      columnas.push(col);
      col = [];
    }
  }
  if (col.length) {
    while (col.length < 7) col.push(null);
    columnas.push(col);
  }
  return { columnas, max };
}

export function matrizMesDias(
  points: AnalyticsTimeseriesPoint[],
  anio: number,
  mes: number, // 1-12
): { semanas: Array<Array<Dia | null>>; max: number } {
  const valorPorFecha = new Map<string, number>();
  let max = 0;
  const prefijo = `${anio}-${String(mes).padStart(2, '0')}`;
  for (const pt of points) {
    if (pt.value === null || !pt.bucket.startsWith(prefijo)) continue;
    valorPorFecha.set(pt.bucket.slice(0, 10), pt.value);
    if (pt.value > max) max = pt.value;
  }
  const diasEnMes = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  const offsetInicial = diaSemanaLunes(Date.UTC(anio, mes - 1, 1));
  const semanas: Array<Array<Dia | null>> = [];
  let semana: Array<Dia | null> = new Array(offsetInicial).fill(null);
  for (let d = 1; d <= diasEnMes; d++) {
    const fecha = `${prefijo}-${String(d).padStart(2, '0')}`;
    semana.push({ fecha, valor: valorPorFecha.has(fecha) ? valorPorFecha.get(fecha)! : null });
    if (semana.length === 7) {
      semanas.push(semana);
      semana = [];
    }
  }
  if (semana.length) {
    while (semana.length < 7) semana.push(null);
    semanas.push(semana);
  }
  return { semanas, max };
}

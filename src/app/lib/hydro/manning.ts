// Verificación hidráulica por la ecuación de Manning. Toma el Q de diseño del
// método racional y resuelve la geometría del conducto (circular o trapezoidal/
// rectangular): capacidad, profundidad normal (por bisección) y chequeos de
// velocidad según RAS 0330. Los valores de n y de velocidad máxima son editables
// en la UI (valores típicos Ven Te Chow / RAS, sujetos a la edición vigente).

export type Estado = 'verde' | 'amarillo' | 'rojo';

const F_MAX = 0.93; // Relación de llenado máxima práctica para el solver circular.

// Manning: Q = (1/n)·A·R^(2/3)·√S, con R = A/P.
export function manningQ(n: number, area: number, perim: number, s: number): number {
  if (!(n > 0) || !(perim > 0) || !(s > 0)) return 0;
  const r = area / perim;
  return (1 / n) * area * Math.pow(r, 2 / 3) * Math.sqrt(s);
}

// Sección circular a tubo lleno: A=πD²/4, P=πD, R=D/4.
export function capacidadCircular(D: number, n: number, s: number): { q: number; v: number } {
  if (!(D > 0)) return { q: 0, v: 0 };
  const area = (Math.PI * D * D) / 4;
  const perim = Math.PI * D;
  const q = manningQ(n, area, perim, s);
  return { q, v: area > 0 ? q / area : 0 };
}

// Geometría de la sección circular para una relación de llenado f = y/D.
function geomCircular(D: number, f: number): { area: number; perim: number } {
  const theta = 2 * Math.acos(1 - 2 * f); // ángulo central del espejo de agua
  const area = ((D * D) / 8) * (theta - Math.sin(theta));
  const perim = (D * theta) / 2;
  return { area, perim };
}

export interface SolverResultado {
  /** Relación de llenado y/D (circular) — clampada a F_MAX si excede. */
  llenado: number;
  /** Profundidad normal [m]. */
  y: number;
  /** Velocidad a esa profundidad [m/s]. */
  v: number;
  /** true si el Q de diseño supera la capacidad práctica de la sección. */
  excedeCapacidad: boolean;
}

// Profundidad normal en sección circular para un Q dado, por bisección sobre f=y/D
// en (0, F_MAX] (rama creciente de la curva de Manning).
export function profundidadNormalCircular(Qd: number, D: number, n: number, s: number): SolverResultado {
  const qAt = (f: number) => {
    const { area, perim } = geomCircular(D, f);
    return manningQ(n, area, perim, s);
  };
  const qMax = qAt(F_MAX);
  if (!(Qd > 0)) return { llenado: 0, y: 0, v: 0, excedeCapacidad: false };
  if (Qd >= qMax) {
    const { area } = geomCircular(D, F_MAX);
    return { llenado: F_MAX, y: F_MAX * D, v: area > 0 ? qMax / area : 0, excedeCapacidad: true };
  }
  let lo = 1e-6;
  let hi = F_MAX;
  // 80 iteraciones de bisección → tolerancia ≈ F_MAX·2⁻⁸⁰ (muy por debajo de la
  // precisión de punto flotante): la solución converge al límite de la máquina.
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (qAt(mid) < Qd) lo = mid;
    else hi = mid;
  }
  const f = (lo + hi) / 2;
  const { area } = geomCircular(D, f);
  return { llenado: f, y: f * D, v: area > 0 ? Qd / area : 0, excedeCapacidad: false };
}

// Profundidad normal en canal trapezoidal (rectangular = z=0) para un Q dado.
// A=(b+z·y)·y, P=b+2y·√(1+z²). Q crece monótono con y → bisección con cota expansiva.
export function profundidadNormalTrapecio(
  Qd: number,
  b: number,
  z: number,
  n: number,
  s: number,
): { y: number; v: number; excedeCapacidad: boolean } {
  const qAt = (y: number) => {
    const area = (b + z * y) * y;
    const perim = b + 2 * y * Math.sqrt(1 + z * z);
    return manningQ(n, area, perim, s);
  };
  if (!(Qd > 0)) return { y: 0, v: 0, excedeCapacidad: false };
  let hi = 0.01;
  let guard = 0;
  while (qAt(hi) < Qd && guard < 60) {
    hi *= 2;
    guard++;
  }
  if (qAt(hi) < Qd) return { y: hi, v: 0, excedeCapacidad: true };
  let lo = 0;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (qAt(mid) < Qd) lo = mid;
    else hi = mid;
  }
  const y = (lo + hi) / 2;
  const area = (b + z * y) * y;
  return { y, v: area > 0 ? Qd / area : 0, excedeCapacidad: false };
}

// Materiales típicos: n de Manning y velocidad máxima admisible (valores de
// referencia Ven Te Chow / RAS 0330, editables en la UI).
export const MATERIALES: Array<{ label: string; n: number; vMax: number }> = [
  { label: 'Concreto', n: 0.013, vMax: 5 },
  { label: 'PVC / plástico liso', n: 0.01, vMax: 6 },
  { label: 'Gres / arcilla vitrificada', n: 0.013, vMax: 5 },
  { label: 'Metal corrugado', n: 0.024, vMax: 4.5 },
  { label: 'Canal en tierra', n: 0.027, vMax: 1.5 },
  { label: 'Mampostería / piedra', n: 0.02, vMax: 4 },
];

export const V_MIN_AUTOLIMPIEZA = 0.75; // m/s — RAS 0330 (2017), velocidad mínima.

// Chequeo de velocidad: sedimentación (< vMin) o erosión (> vMax). Amarillo si está
// dentro de rango pero a menos del 10% de cualquiera de los límites.
export function chequeoVelocidad(v: number, vMin: number, vMax: number): { estado: Estado; motivo: string } {
  if (v < vMin) return { estado: 'rojo', motivo: `v = ${v.toFixed(2)} m/s < ${vMin} m/s: riesgo de sedimentación (no autolimpiante).` };
  if (v > vMax) return { estado: 'rojo', motivo: `v = ${v.toFixed(2)} m/s > ${vMax} m/s: riesgo de erosión del material.` };
  if (v < vMin * 1.1 || v > vMax * 0.9) return { estado: 'amarillo', motivo: `v = ${v.toFixed(2)} m/s: cerca de un límite (autolimpieza ${vMin} / máx. ${vMax} m/s).` };
  return { estado: 'verde', motivo: `v = ${v.toFixed(2)} m/s dentro del rango (${vMin}–${vMax} m/s).` };
}

// Chequeo de suficiencia: el conducto debe poder transportar el Q de diseño.
export function chequeoSuficiencia(Qd: number, qCap: number): { estado: Estado; motivo: string } {
  if (Qd > qCap) return { estado: 'rojo', motivo: `Q de diseño (${Qd.toFixed(3)} m³/s) supera la capacidad (${qCap.toFixed(3)} m³/s): sección insuficiente.` };
  if (Qd > qCap * 0.9) return { estado: 'amarillo', motivo: `Q de diseño usa más del 90% de la capacidad: poco margen.` };
  return { estado: 'verde', motivo: `Capacidad suficiente (Q de diseño = ${(qCap > 0 ? (100 * Qd) / qCap : 0).toFixed(0)}% de la capacidad).` };
}

// Chequeo de llenado (sección circular): RAS limita y/D ≤ 0,85.
export function chequeoLlenado(llenado: number): { estado: Estado; motivo: string } {
  if (llenado > 0.85) return { estado: 'rojo', motivo: `Llenado y/D = ${(llenado * 100).toFixed(0)}% > 85% (RAS 0330): revisar diámetro.` };
  if (llenado > 0.75) return { estado: 'amarillo', motivo: `Llenado y/D = ${(llenado * 100).toFixed(0)}%: cercano al límite del 85%.` };
  return { estado: 'verde', motivo: `Llenado y/D = ${(llenado * 100).toFixed(0)}% (≤ 85%, RAS 0330).` };
}

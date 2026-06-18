// Equivalencias de precipitación para mostrar al usuario.
// Base física verificada: 1 mm de lluvia = 1 litro de agua por metro cuadrado
// (fuente: NASA S'COOL / FAO). NO usar la analogía de "piscina" (numéricamente falsa).

export type IntensidadLluvia = 'sin_lluvia' | 'debil' | 'moderada' | 'fuerte' | 'muy_fuerte';

const noNeg = (n: number): number => (Number.isFinite(n) && n > 0 ? n : 0);

/** Litros sobre 1 m² para `mm` de lluvia (numéricamente == mm). */
export function mmPorM2(mm: number): number {
  return Math.round(noNeg(mm));
}

/** Litros totales de `mm` de lluvia sobre `areaM2` metros cuadrados. */
export function mmAreaLitros(mm: number, areaM2: number): number {
  return Math.round(noNeg(mm) * noNeg(areaM2));
}

/**
 * Clasifica la intensidad de lluvia por umbrales OMM/WMO, en mm por hora.
 * débil <2,5 · moderada 2,5–7,6 · fuerte 7,6–50 · muy fuerte ≥50.
 */
export function clasificarIntensidad(mmPorHora: number): IntensidadLluvia {
  const v = noNeg(mmPorHora);
  if (v === 0) return 'sin_lluvia';
  if (v < 2.5) return 'debil';
  if (v < 7.6) return 'moderada';
  if (v < 50) return 'fuerte';
  return 'muy_fuerte';
}

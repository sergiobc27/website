// Coeficiente de escorrentía C y caudal por el método racional.
// El C se elige por tipo de superficie (valor base editable dentro de su rango)
// y se ajusta por el factor de frecuencia Cf(Tr); no se inventa una matriz
// superficie×pendiente: la pendiente guía la elección dentro del rango (tooltip).

// Coeficientes C típicos en Colombia (rango y valor de referencia) — RAS 0330 /
// manuales de drenaje. Reutilizados de la calculadora original.
export const TIPOS_SUPERFICIE: Array<{ label: string; c: number; rango: string }> = [
  { label: 'Pavimento asfáltico / concreto', c: 0.85, rango: '0,70–0,95' },
  { label: 'Techos / cubiertas', c: 0.85, rango: '0,75–0,95' },
  { label: 'Zona comercial / densa', c: 0.7, rango: '0,60–0,85' },
  { label: 'Residencial', c: 0.5, rango: '0,40–0,65' },
  { label: 'Zonas verdes / parques', c: 0.2, rango: '0,10–0,30' },
  { label: 'Suelo natural / cultivos', c: 0.2, rango: '0,10–0,35' },
];

// Superficies impermeables: disparan el aviso de que Kirpich subestima Tc (urbano).
export const SUPERFICIES_IMPERMEABLES = new Set([
  'Pavimento asfáltico / concreto',
  'Techos / cubiertas',
  'Zona comercial / densa',
]);

// Factor de frecuencia Cf (Ven Te Chow; adoptado por el Manual de Drenaje INVÍAS):
// ajusta C al alza para periodos de retorno mayores. C·Cf se topa en 1,0.
export function factorFrecuencia(tr: number): number {
  if (tr <= 10) return 1.0;
  if (tr <= 25) return 1.1;
  if (tr <= 50) return 1.2;
  return 1.25;
}

export function cAjustado(cBase: number, tr: number): number {
  return Math.min(1, cBase * factorFrecuencia(tr));
}

// Método racional: Q[m³/s] = C·I·A/360  (C adimensional, I en mm/h, A en hectáreas).
export function qRacional(c: number, i_mmh: number, a_ha: number): number {
  return (c * i_mmh * a_ha) / 360;
}

// Periodos de retorno de diseño sugeridos por tipo de obra. Valores típicos de las
// normas colombianas; el Tr es sobrescribible y se debe confirmar con la edición
// vigente de la norma para la obra concreta.
export const OBRAS_TR: Array<{ label: string; tr: number; fuente: string }> = [
  { label: 'Cuneta / drenaje vial menor', tr: 10, fuente: 'INVÍAS, Manual de Drenaje (2009)' },
  { label: 'Alcantarilla / box-culvert vial', tr: 25, fuente: 'INVÍAS, Manual de Drenaje (2009)' },
  { label: 'Pontón / puente menor', tr: 50, fuente: 'INVÍAS, Manual de Drenaje (2009)' },
  { label: 'Puente', tr: 100, fuente: 'INVÍAS, Manual de Drenaje (2009)' },
  { label: 'Drenaje urbano — riesgo bajo', tr: 5, fuente: 'RAS 0330 (2017)' },
  { label: 'Drenaje urbano — riesgo medio', tr: 10, fuente: 'RAS 0330 (2017)' },
  { label: 'Drenaje urbano — riesgo alto', tr: 25, fuente: 'RAS 0330 (2017)' },
];

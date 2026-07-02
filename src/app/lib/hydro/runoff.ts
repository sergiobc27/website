// Coeficiente de escorrentía C y caudal por el método racional.
// El C se elige por tipo de superficie (valor base editable dentro de su rango)
// y se ajusta por el factor de frecuencia Cf(Tr); no se inventa una matriz
// superficie×pendiente: la pendiente guía la elección dentro del rango (tooltip).

import type { TiemposTc, MetodoTc } from './tc';

// Agrupa las entradas, los intermedios y la salida de UN cálculo del método
// racional. Antes CalculadoraCaudal pasaba estos mismos 13 valores como props
// sueltas a CalculoPasoAPaso (firma, llamada y cuerpo había que tocar los tres al
// agregar un campo); ahora se construye una vez y se pasa como un solo objeto.
export interface ResultadoRacional {
  L: number;
  S: number;
  A: number;
  tcs: TiemposTc;
  tcUsado: number;
  tcMetodo: MetodoTc | 'recomendado';
  cBase: number;
  cf: number;
  cAjust: number;
  tr: number;
  equation: { K: number; m: number; n: number };
  intensidad: number;
  q: number;
}

// El coeficiente C se toma directamente de las tablas del Manual de Drenaje INVÍAS
// (2009): Tabla 2.9 (áreas urbanas) o Tabla 2.10 (áreas rurales). Esos datos viven
// en `tablasNorma.ts` (única fuente) y el selector de la calculadora lee de ahí; no
// se mantiene aquí una lista simplificada aparte.

// Factor de frecuencia Cf (atribuido a Chow, Maidment y Mays, 1988; NO aparece en
// el Manual de Drenaje INVÍAS, ver tablasNorma.ts): ajusta C al alza para periodos
// de retorno mayores. C·Cf se topa en 1,0.
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

// Evaluación de la curva IDF ajustada: I[mm/h] = K·Tᵐ/Dⁿ (T en años, D en minutos
// = duración de diseño; para el método racional, D = Tc). Centraliza el cómputo
// que antes se repetía inline en la calculadora, para que quede testeado en la
// capa pura junto al resto de la aritmética hidrológica.
export function intensidadIdf(eq: { K: number; m: number; n: number }, T: number, D_min: number): number {
  return (eq.K * Math.pow(T, eq.m)) / Math.pow(D_min, eq.n);
}

// Períodos de retorno de diseño, LITERALES de la norma citada. El Tr es
// sobrescribible; aquí solo se sugiere el de la fuente.
// Vial: Manual de Drenaje INVÍAS (2009), Tabla 2.8 (pág. 2-31).
// Urbano: RAS 0330 de 2017, Art. 135, Tabla 16 (por área tributaria).
export const OBRAS_TR: Array<{ label: string; tr: number; fuente: string }> = [
  // Drenaje vial — INVÍAS (2009), Tabla 2.8
  { label: 'Cuneta', tr: 5, fuente: 'INVÍAS (2009), Tabla 2.8' },
  { label: 'Zanja de coronación', tr: 10, fuente: 'INVÍAS (2009), Tabla 2.8' },
  { label: 'Estructura de caída', tr: 10, fuente: 'INVÍAS (2009), Tabla 2.8' },
  { label: 'Alcantarilla de 0,90 m de diámetro', tr: 10, fuente: 'INVÍAS (2009), Tabla 2.8' },
  { label: 'Alcantarilla mayor a 0,90 m de diámetro', tr: 20, fuente: 'INVÍAS (2009), Tabla 2.8' },
  { label: 'Puente menor (luz < 10 m)', tr: 25, fuente: 'INVÍAS (2009), Tabla 2.8' },
  { label: 'Puente (luz 10–50 m)', tr: 50, fuente: 'INVÍAS (2009), Tabla 2.8' },
  { label: 'Puente (luz ≥ 50 m)', tr: 100, fuente: 'INVÍAS (2009), Tabla 2.8' },
  { label: 'Drenaje subsuperficial', tr: 2, fuente: 'INVÍAS (2009), Tabla 2.8' },
  // Drenaje urbano — RAS 0330 (2017), Art. 135, Tabla 16
  { label: 'Tramo inicial residencial (< 2 ha)', tr: 3, fuente: 'RAS 0330 (2017), Art. 135, Tabla 16' },
  { label: 'Tramo inicial comercial/industrial (< 2 ha)', tr: 5, fuente: 'RAS 0330 (2017), Art. 135, Tabla 16' },
  { label: 'Alcantarillado pluvial (2–10 ha)', tr: 5, fuente: 'RAS 0330 (2017), Art. 135, Tabla 16' },
  { label: 'Alcantarillado pluvial (> 10 ha)', tr: 10, fuente: 'RAS 0330 (2017), Art. 135, Tabla 16' },
  { label: 'Canal abierto (< 1000 ha)', tr: 50, fuente: 'RAS 0330 (2017), Art. 135, Tabla 16' },
  { label: 'Canal abierto (> 1000 ha)', tr: 100, fuente: 'RAS 0330 (2017), Art. 135, Tabla 16' },
];

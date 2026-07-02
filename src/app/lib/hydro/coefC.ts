// Selección del coeficiente de escorrentía C desde las tablas literales de la
// norma (INVÍAS 2009, Tablas 2.9 urbana / 2.10 rural): parseo de los valores de
// celda (número suelto o rango "lo – hi") y las funciones que fija la calculadora
// al hacer clic en una fila/celda. Extraído de SeccionCoefC.tsx para que la
// lógica quede testeada en la capa pura, igual que el resto de lib/hydro.

/** Número en formato es-CO (coma decimal) a float. */
export function parseNum(s: string | number): number {
  return parseFloat(String(s).replace(',', '.'));
}

export interface Rango {
  lo: number;
  hi: number;
  mid: number;
}

/** Rango "lo – hi" (acepta guion, en-dash o em-dash como separador, con o sin
 * espacios) a {lo, hi, mid}. Si la celda es un número suelto (tabla rural),
 * lo/hi/mid quedan todos iguales a ese valor. */
export function parseRango(s: string | number): Rango {
  const partes = String(s).split(/[–—-]/).map((x) => parseNum(x));
  const [a, b] = partes;
  if (b == null || Number.isNaN(b)) return { lo: a, hi: a, mid: a };
  return { lo: a, hi: b, mid: (a + b) / 2 };
}

/** true si cBase queda fuera del rango [lo, hi] de la fila activa. */
export function fueraDeRango(rango: Rango | null, cBase: number): boolean {
  return !!rango && Number.isFinite(cBase) && (cBase < rango.lo || cBase > rango.hi);
}

export interface SeleccionCelda {
  fila: number;
  col: number;
}

/** Selección en la tabla urbana (Tabla 2.9): la columna de valor es siempre la 1
 * (una sola columna "C"); el valor elegido es el punto medio del rango de la fila. */
export function pickUrbana(fila: number, valor: string | number): { sel: SeleccionCelda; cBase: number } {
  return { sel: { fila, col: 1 }, cBase: parseRango(valor).mid };
}

/** Selección en la tabla rural (Tabla 2.10): la columna clicada se respeta (varía
 * por textura del suelo); el valor es literal, sin rango. */
export function pickRural(fila: number, col: number, valor: string | number): { sel: SeleccionCelda; cBase: number } {
  return { sel: { fila, col }, cBase: parseNum(valor) };
}

// Formato numérico UNIFICADO para toda la app: es-CO (miles con punto, decimales
// con coma → 1.234,5). Evita la ambigüedad de mezclar el punto-decimal crudo de
// JavaScript (569.616 = 569,6) con el punto-miles de los conteos (764.724.334).
// Úsalo en TODO valor numérico mostrado al usuario.
export function fmt(value: number | null | undefined, decimals = 1): string {
  if (value == null || typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return value.toLocaleString('es-CO', { maximumFractionDigits: decimals, minimumFractionDigits: 0 });
}

/** Entero localizado (miles con punto), para conteos. */
export function fmtInt(value: number | null | undefined): string {
  return fmt(value, 0);
}

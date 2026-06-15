// Constantes compartidas por las vistas analíticas. Evita redefinir el mismo
// dataset id y los nombres de mes en cada componente.

/** Dataset id de precipitación (10-min) del IDEAM en datos.gov.co. */
export const PRECIP_DATASET = 's54a-sgyg';

/** Nombres de mes abreviados (es-CO), índice 0 = enero. */
export const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

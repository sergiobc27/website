// Unidad de medida por variable (datasetId) del IDEAM. Unidades estándar
// (confirmadas contra la columna unidadmedida: presión=hPa, niveles=m).
const UNIT_BY_DATASET: Record<string, string> = {
  's54a-sgyg': 'mm', // Precipitación
  'ccvq-rp9s': '°C', // Temp. máxima del aire
  'afdg-3zpb': '°C', // Temp. mínima del aire
  'uext-mhny': '%', // Humedad del aire
  '62tk-nxj5': 'hPa', // Presión atmosférica
  'sgfv-3yp8': 'm/s', // Velocidad del viento
  'kiw7-v9ta': '°', // Dirección del viento
  'vfth-yucv': 'm', // Nivel máximo del río
  'bdmn-sqnh': 'm', // Nivel instantáneo del río
  'pt9a-aamx': 'm', // Nivel mínimo del río
  'ia8x-22em': 'm', // Nivel del mar
  'uxy3-jchf': 'm', // Nivel del mar máximo
  '7z6g-yx9q': 'm', // Nivel del mar mínimo
};

/** Unidad física de la variable (ej. 'mm', '°C', 'm'); '' si se desconoce. */
export function datasetUnit(datasetId: string): string {
  return UNIT_BY_DATASET[datasetId] || '';
}

/** Unidad de una métrica: 'count' es un conteo de observaciones (sin unidad
 * física); el resto (avg/sum/min/max) conserva la unidad de la variable. */
export function metricUnit(datasetId: string, metric: string): string {
  if (metric === 'count') return 'obs';
  return datasetUnit(datasetId);
}

/** Sufijo " (unidad)" listo para concatenar a una etiqueta, vacío si no hay. */
export function unitSuffix(unit: string): string {
  return unit ? ` (${unit})` : '';
}

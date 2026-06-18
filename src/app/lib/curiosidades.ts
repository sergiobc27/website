// Datos curiosos contextuales que se muestran durante la espera de la descarga.
// Pool PRECARGADO estático (cero latencia; funciona aunque la API tarde o falle).
// Tono divulgativo con chispa. Reglas de rigor (tesis): cifras verificables, sin
// "1 mm llena una piscina" (falso) y sin citar Lloró ~13.000 mm (no oficial, en disputa).

export interface Curiosidad {
  texto: string;
  fuente?: string;
}

// Analogías universales de precipitación (verificadas).
export const ANALOGIAS_PRECIPITACION: Curiosidad[] = [
  { texto: '1 mm de lluvia equivale a 1 litro de agua sobre cada metro cuadrado de suelo.', fuente: 'FAO / NASA' },
  { texto: 'Con 1 mm de lluvia, una cancha de fútbol recoge más de 7.000 litros de agua.' },
  { texto: 'Las estaciones del IDEAM miden la lluvia cada 10 minutos — por eso se pueden construir curvas IDF reales.', fuente: 'IDEAM' },
  { texto: 'Un aguacero fuerte (más de 7,5 mm/h, según la OMM) deja sobre cada m² un vaso de agua cada dos minutos.', fuente: 'OMM' },
];

// Hechos genéricos de plataforma (fallback). Cifras estables/redondeadas.
export const CURIOSIDADES_GENERICAS: Curiosidad[] = [
  { texto: 'El espejo de datos guarda más de 760 millones de observaciones del IDEAM.', fuente: 'IDEAM' },
  { texto: 'Esta herramienta cubre los 32 departamentos de Colombia.', fuente: 'IDEAM' },
  { texto: 'Los registros llegan en intervalos de 10 minutos, no solo a diario.' },
];

// Datos por departamento (clave = nombre en MAYÚSCULAS, igual que los chips de Territorio).
export const CURIOSIDADES_POR_DEPARTAMENTO: Record<string, Curiosidad[]> = {
  'CHOCO': [{ texto: 'En Quibdó (Chocó) caen más de 8.000 mm al año, casi 10 veces lo de Bogotá.' }],
  'LA GUAJIRA': [{ texto: 'En Uribia (La Guajira) caen apenas ~250 mm al año: el rincón más seco de Colombia.' }],
  'ATLANTICO': [{ texto: 'En Barranquilla pocos minutos de aguacero bastan para que los arroyos corran por las calles.' }],
  'BOGOTA D.C.': [{ texto: 'Bogotá tiene dos temporadas de lluvia al año (régimen bimodal): abril-mayo y octubre-noviembre.' }],
  'CUNDINAMARCA': [{ texto: 'La sabana de Cundinamarca tiene régimen bimodal: dos picos de lluvia al año.' }],
  'AMAZONAS': [{ texto: 'El Amazonas colombiano es de los lugares más húmedos y lluviosos del país durante casi todo el año.' }],
};

/**
 * Selección contextual: específicas del departamento + analogías (si es precipitación)
 * + genéricas, sin duplicar. Siempre devuelve al menos las genéricas.
 */
export function seleccionarCuriosidades(opts: { esPrecipitacion: boolean; departamentos: string[] }): Curiosidad[] {
  const out: Curiosidad[] = [];
  for (const d of opts.departamentos ?? []) {
    const key = typeof d === 'string' ? d.toUpperCase() : d;
    const arr = CURIOSIDADES_POR_DEPARTAMENTO[key];
    if (arr) out.push(...arr);
  }
  if (opts.esPrecipitacion) out.push(...ANALOGIAS_PRECIPITACION);
  out.push(...CURIOSIDADES_GENERICAS);
  return Array.from(new Set(out)); // dedupe por referencia
}

/** Siguiente índice de rotación evitando repetir el actual. `rng` inyectable para tests. */
export function siguienteIndice(actual: number, total: number, rng: () => number = Math.random): number {
  if (total <= 1) return 0;
  let i = Math.floor(rng() * total);
  if (i >= total) i = total - 1;
  if (i === actual) i = (i + 1) % total;
  return i;
}

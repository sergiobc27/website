// Vistas temáticas de la coropleta del mapa de estaciones. Cada vista elige por
// su cuenta la variable IDEAM y la métrica correcta, con su unidad y degradado.
// Lógica pura y testeable (sin React ni MapLibre).
import type { FeatureCollection } from 'geojson';
import { daneDeDepartamento } from './departamentos';

export type MetricaVista = 'monthlyDepth' | 'mean' | 'stationCount' | 'catalogStations';
export type FamiliaVista = 'Clima' | 'Cobertura' | 'Agua';

export interface VistaMapa {
  id: string;
  rotulo: string;
  familia: FamiliaVista;
  /** datasetId de Socrata, o null para vistas que no dependen de una variable. */
  datasetId: string | null;
  metrica: MetricaVista;
  unidad: string;
  /** true => el valor bajo es el más intenso (ej. "dónde hace más frío"). */
  invertir?: boolean;
  /** true => se rotula "datos en revisión" (calidad conocida limitada). */
  enRevision?: boolean;
  /** 4 colores del degradado, de menor a mayor valor. */
  rampa: string[];
}

// Degradados secuenciales de un tono, elegidos por significado (agua=azul,
// calor=cálido, etc.). El público los ajusta sobre el resultado si hace falta.
const AZUL_LLUVIA = ['rgba(186,230,253,0.15)', 'rgba(56,189,248,0.45)', 'rgba(2,132,199,0.62)', 'rgba(12,74,110,0.74)'];
const CALIDO = ['rgba(254,240,138,0.18)', 'rgba(253,186,116,0.5)', 'rgba(249,115,22,0.62)', 'rgba(153,27,27,0.76)'];
const FRIO = ['rgba(224,242,254,0.15)', 'rgba(125,211,252,0.45)', 'rgba(56,114,224,0.62)', 'rgba(30,27,120,0.76)'];
const HUMEDAD = ['rgba(204,251,241,0.15)', 'rgba(94,234,212,0.45)', 'rgba(13,148,136,0.62)', 'rgba(15,76,84,0.74)'];
const VIENTO = ['rgba(226,232,240,0.15)', 'rgba(148,184,194,0.45)', 'rgba(71,130,148,0.62)', 'rgba(30,64,84,0.74)'];
const DORADO = ['rgba(201,162,39,0.06)', 'rgba(201,162,39,0.28)', 'rgba(201,162,39,0.5)', 'rgba(163,22,26,0.58)'];
const INDIGO = ['rgba(199,210,254,0.15)', 'rgba(129,140,248,0.45)', 'rgba(67,56,202,0.62)', 'rgba(30,27,90,0.74)'];
const MAR = ['rgba(186,230,253,0.15)', 'rgba(45,212,191,0.45)', 'rgba(2,132,199,0.62)', 'rgba(8,47,73,0.74)'];

export const VISTAS_MAPA: VistaMapa[] = [
  { id: 'lluvia', rotulo: 'Dónde llueve más', familia: 'Clima', datasetId: 's54a-sgyg', metrica: 'monthlyDepth', unidad: 'mm/mes', rampa: AZUL_LLUVIA },
  { id: 'calor', rotulo: 'Dónde hace más calor', familia: 'Clima', datasetId: 'ccvq-rp9s', metrica: 'mean', unidad: '°C', rampa: CALIDO },
  { id: 'frio', rotulo: 'Dónde hace más frío', familia: 'Clima', datasetId: 'afdg-3zpb', metrica: 'mean', unidad: '°C', invertir: true, rampa: FRIO },
  { id: 'humedad', rotulo: 'Qué tan húmedo es el aire', familia: 'Clima', datasetId: 'uext-mhny', metrica: 'mean', unidad: '%', rampa: HUMEDAD },
  { id: 'viento', rotulo: 'Qué tan fuerte sopla el viento', familia: 'Clima', datasetId: 'sgfv-3yp8', metrica: 'mean', unidad: 'm/s', rampa: VIENTO },
  { id: 'cobertura', rotulo: 'Dónde hay más estaciones', familia: 'Cobertura', datasetId: null, metrica: 'catalogStations', unidad: 'estaciones', rampa: DORADO },
  { id: 'rios', rotulo: 'Nivel de los ríos', familia: 'Agua', datasetId: 'bdmn-sqnh', metrica: 'mean', unidad: 'm', enRevision: true, rampa: INDIGO },
  { id: 'mar', rotulo: 'Nivel del mar', familia: 'Agua', datasetId: 'ia8x-22em', metrica: 'mean', unidad: 'm', rampa: MAR },
];

export function vistaPorId(id: string): VistaMapa | undefined {
  return VISTAS_MAPA.find((v) => v.id === id);
}

const ORDEN_FAMILIA: FamiliaVista[] = ['Clima', 'Cobertura', 'Agua'];

/** Vistas agrupadas por familia, en orden, para pintar el desplegable. */
export function vistasPorFamilia(): { familia: FamiliaVista; vistas: VistaMapa[] }[] {
  return ORDEN_FAMILIA.map((familia) => ({ familia, vistas: VISTAS_MAPA.filter((v) => v.familia === familia) })).filter(
    (g) => g.vistas.length
  );
}

/** Fila por departamento que devuelve /api/analytics/by-region. */
export interface RegionRow {
  department: string;
  rowCount: number;
  mean: number | null;
  stationCount: number;
  monthlyDepth?: number | null;
}

// La API agrupa por departamento CRUDO, así que un departamento canónico puede
// llegar en varias filas (variantes de nombre/mojibake). Se combina por DANE:
// conteos se suman; magnitudes se promedian ponderando por rowCount (proxy del
// tamaño de muestra), ignorando variantes con valor nulo.
export function valoresPorDane(regions: RegionRow[], metrica: MetricaVista): Map<string, number> {
  if (metrica === 'stationCount') {
    const out = new Map<string, number>();
    for (const r of regions) {
      const dane = daneDeDepartamento(r.department);
      if (!dane) continue;
      out.set(dane, (out.get(dane) || 0) + (r.stationCount || 0));
    }
    return out;
  }
  const acc = new Map<string, { suma: number; peso: number }>();
  for (const r of regions) {
    const dane = daneDeDepartamento(r.department);
    if (!dane) continue;
    const valor = metrica === 'monthlyDepth' ? r.monthlyDepth : r.mean;
    if (valor === null || valor === undefined) continue;
    const peso = r.rowCount > 0 ? r.rowCount : 1;
    const prev = acc.get(dane) || { suma: 0, peso: 0 };
    acc.set(dane, { suma: prev.suma + valor * peso, peso: prev.peso + peso });
  }
  const out = new Map<string, number>();
  for (const [dane, { suma, peso }] of acc) if (peso > 0) out.set(dane, suma / peso);
  return out;
}

/** Cuenta estaciones del catálogo por DANE (vista "cobertura"). Descarta las de
 * departamento nulo o no mapeable. */
export function contarEstacionesPorDane(stations: Array<{ departamento: string | null }>): Map<string, number> {
  const out = new Map<string, number>();
  for (const s of stations) {
    const dane = daneDeDepartamento(s.departamento);
    if (!dane) continue;
    out.set(dane, (out.get(dane) || 0) + 1);
  }
  return out;
}

/** Une los límites departamentales con el valor por DANE y marca hasData para
 * distinguir "sin dato" (gris) de "valor bajo". */
export function construirFeatures(boundaries: FeatureCollection, valorPorDane: Map<string, number>): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: (boundaries.features || []).map((feature) => {
      const props = (feature.properties || {}) as Record<string, unknown>;
      const dane = String(props.DANE || '');
      const nombre = String(props.NOMBRE_DPT || '');
      const hasData = valorPorDane.has(dane);
      const valor = hasData ? (valorPorDane.get(dane) as number) : 0;
      return { ...feature, properties: { NOMBRE_DPT: nombre, DANE: dane, valor, hasData } };
    }),
  };
}

export function rangoValores(valores: number[]): { min: number; max: number } {
  if (!valores.length) return { min: 0, max: 0 };
  return { min: Math.min(...valores), max: Math.max(...valores) };
}

/** Expresión MapLibre de relleno: interpola el color de la rampa entre min y max
 * (degradado invertido si la vista resalta los valores bajos). Garantiza tramos
 * estrictamente crecientes aunque min == max. */
export function expresionRelleno(vista: VistaMapa, min: number, max: number): unknown[] {
  const lo = min;
  const hi = max > min ? max : min + 1;
  const span = hi - lo;
  const colores = vista.invertir ? [...vista.rampa].reverse() : vista.rampa;
  return [
    'interpolate', ['linear'], ['get', 'valor'],
    lo, colores[0],
    lo + span * 0.25, colores[1],
    lo + span * 0.6, colores[2],
    hi, colores[3],
  ];
}

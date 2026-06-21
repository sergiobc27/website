// Lógica pura del scrollytelling "La historia del dato" (testeable sin DOM).
// El dataset embebido lo genera scripts/generar-historia-idf.mjs.

export interface HistoriaIdfData {
  generadoEl: string;
  fuente: string;
  estacion: {
    codigo: string;
    nombre: string;
    municipio: string;
    departamento: string;
    aniosValidos: number;
    fiabilidad: string;
  };
  tormenta: { fecha: string; puntos: Array<{ hora: string; mm: number }>; totalMm: number; maxIntensidadMmH: number };
  maximosAnuales: Array<{ anio: number; mm: number }>;
  gumbel: { mu: number; beta: number } | null;
  empiricos: Array<{ tr: number; mm: number }>;
  cuantiles: Array<{ tr: number; mm: number; lower?: number; upper?: number }>;
  curvas: Array<{ tr: number; puntos: Array<{ durMin: number; mmH: number; lowerMmH?: number; upperMmH?: number }> }>;
  ecuacion: { K: number; m: number; n: number; r2: number; r2Space?: string } | null;
  nAnios: number;
}

export const TOTAL_ESCENAS = 8;

/** Escena activa (1-indexada) = sección con mayor ratio visible; sin señal, conserva la actual. */
export function escenaMasVisible(ratios: number[], actual = 1): number {
  let mejor = -1;
  let idx = -1;
  ratios.forEach((r, i) => {
    if (r > mejor) {
      mejor = r;
      idx = i;
    }
  });
  return mejor > 0 ? idx + 1 : actual;
}

const ROMANOS = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'] as const;

/** Numeral romano para 1-10 (los capítulos de la historia). Fuera de rango: el número como texto. */
export function aRomano(n: number): string {
  return n >= 1 && n <= 10 ? ROMANOS[n] : String(n);
}

/**
 * Progreso de lectura 0..1 (continuo, ligado al scroll real).
 * @param topRelativo  top del contenedor de la historia respecto al tope del scroller (0 al empezar, negativo al avanzar)
 * @param alto         alto total del contenedor de la historia
 * @param ventanaAlto  alto visible del scroller
 * Si el contenido cabe entero en la ventana, devuelve 1 (todo visible = leído).
 */
export function progresoLectura(topRelativo: number, alto: number, ventanaAlto: number): number {
  const recorrido = alto - ventanaAlto;
  if (recorrido <= 0) return 1;
  const p = -topRelativo / recorrido;
  return p <= 0 ? 0 : p > 1 ? 1 : p;
}

/** Chequeo de shape del dataset embebido (lo usan el test y quien regenere). */
export function validarHistoria(d: HistoriaIdfData): string[] {
  const errores: string[] = [];
  if (!d.estacion?.codigo) errores.push('estacion.codigo vacío');
  if (!d.tormenta?.puntos?.length) errores.push('tormenta.puntos vacío');
  if (!d.maximosAnuales?.length) errores.push('maximosAnuales vacío');
  if (!d.cuantiles?.length) errores.push('cuantiles vacío');
  if (!d.curvas?.length || d.curvas.some((c) => !c.puntos.length)) errores.push('curvas vacías');
  if (!d.nAnios || d.nAnios < 5) errores.push('nAnios < 5');
  return errores;
}

/** Intensidad (mm/h) para un Tr y duración: curva del Tr más cercano, punto exacto de la duración. */
export function intensidadDeCurva(
  curvas: HistoriaIdfData['curvas'],
  tr: number,
  durMin: number,
): { tr: number; durMin: number; mmH: number } | null {
  if (!curvas.length) return null;
  const curva = curvas.reduce((m, c) => (Math.abs(c.tr - tr) < Math.abs(m.tr - tr) ? c : m));
  const punto = curva.puntos.find((p) => p.durMin === durMin) || curva.puntos[0];
  return punto ? { tr: curva.tr, durMin: punto.durMin, mmH: punto.mmH } : null;
}

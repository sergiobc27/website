// Tiempo de concentración por varios métodos empíricos de una línea.
// Entradas unificadas: L = longitud del cauce [m], S = pendiente media [m/m],
// A = área de la cuenca [ha]. Salida en minutos. Cada método devuelve null si
// sus entradas no son válidas (evita NaN en la UI).

const MIN_DISENO = 10; // Piso de diseño: extremo del rango 3–10 min del RAS 0330 (Art. 135, num. 4).

export type MetodoTc = 'kirpich' | 'temez' | 'giandotti';

// Superficie del recorrido del flujo, para el Kirpich modificado (urbano). El Tc de
// Kirpich se derivó de cuencas RURALES; para recorridos pavimentados se multiplica
// por un factor de ajuste (Kirpich, 1940, reproducido en manuales de drenaje):
// natural/rural = 1,0; asfalto/concreto = 0,4; canal revestido en concreto = 0,2.
export type Recorrido = 'rural' | 'urbano' | 'canal';
export const FACTOR_RECORRIDO: Record<Recorrido, number> = { rural: 1, urbano: 0.4, canal: 0.2 };

export interface TiemposTc {
  kirpich: number | null;
  temez: number | null;
  giandotti: number | null;
  /** Mediana de los métodos válidos, elevada al piso de diseño de 10 min. */
  recomendado: number | null;
  /** Método más cercano a la mediana (para n par, al promedio de los centrales). */
  metodoRecomendado: MetodoTc | null;
  /** true si el piso de 10 min elevó el valor recomendado. */
  pisoAplicado: boolean;
  /** Factor de recorrido aplicado a Kirpich (1,0 rural; 0,4 urbano; 0,2 canal). */
  factorRecorrido: number;
  /** true si se aplicó el Kirpich modificado (factor distinto de 1). */
  kirpichModificado: boolean;
}

// Kirpich (1940): Tc[min] = 0,0195·L^0,77·S^−0,385  (L en m, S en m/m). El `factor`
// aplica el Kirpich modificado para recorridos urbanos (ver FACTOR_RECORRIDO).
export function kirpich(L: number, S: number, factor = 1): number | null {
  if (!(L > 0) || !(S > 0)) return null;
  return factor * 0.0195 * Math.pow(L, 0.77) * Math.pow(S, -0.385);
}

// Témez (1978): Tc[h] = 0,3·(L_km / S^0,25)^0,76  → ×60 a minutos (L en km, S en m/m).
export function temez(L: number, S: number): number | null {
  if (!(L > 0) || !(S > 0)) return null;
  const Lkm = L / 1000;
  return 0.3 * Math.pow(Lkm / Math.pow(S, 0.25), 0.76) * 60;
}

// Giandotti: Tc[h] = (4·√A_km² + 1,5·L_km) / (25,3·√(S·L_km)) → ×60 a minutos
// (forma con pendiente; A en km², L en km, S en m/m adimensional).
export function giandotti(L: number, S: number, A_ha: number): number | null {
  if (!(L > 0) || !(S > 0) || !(A_ha > 0)) return null;
  const Lkm = L / 1000;
  const Akm2 = A_ha / 100;
  return ((4 * Math.sqrt(Akm2) + 1.5 * Lkm) / (25.3 * Math.sqrt(S * Lkm))) * 60;
}

export function tiemposConcentracion(L: number, S: number, A_ha: number, factor = 1): TiemposTc {
  const k = kirpich(L, S, factor);
  const t = temez(L, S);
  const g = giandotti(L, S, A_ha);

  const pares: Array<{ m: MetodoTc; v: number }> = [];
  if (k != null) pares.push({ m: 'kirpich', v: k });
  if (t != null) pares.push({ m: 'temez', v: t });
  if (g != null) pares.push({ m: 'giandotti', v: g });

  let recomendado: number | null = null;
  let metodoRecomendado: MetodoTc | null = null;
  let pisoAplicado = false;

  if (pares.length > 0) {
    const ordenado = [...pares].sort((a, b) => a.v - b.v);
    const n = ordenado.length;
    // Mediana real: para n impar, el valor central; para n par (p. ej. cuando un
    // método queda null), el PROMEDIO de los dos centrales (no el menor, que era
    // el bug: subestimaba Tc → sobreestimaba la intensidad y el caudal).
    const medV =
      n % 2 === 1 ? ordenado[(n - 1) / 2].v : (ordenado[n / 2 - 1].v + ordenado[n / 2].v) / 2;
    // Método representativo = el más cercano a la mediana (coincide con el central
    // si n es impar).
    metodoRecomendado = ordenado.reduce((best, cur) =>
      Math.abs(cur.v - medV) < Math.abs(best.v - medV) ? cur : best,
    ).m;
    if (medV < MIN_DISENO) {
      recomendado = MIN_DISENO;
      pisoAplicado = true;
    } else {
      recomendado = medV;
    }
  }

  return {
    kirpich: k,
    temez: t,
    giandotti: g,
    recomendado,
    metodoRecomendado,
    pisoAplicado,
    factorRecorrido: factor,
    kirpichModificado: factor !== 1,
  };
}

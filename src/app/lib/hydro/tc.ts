// Tiempo de concentración por varios métodos empíricos de una línea.
// Entradas unificadas: L = longitud del cauce [m], S = pendiente media [m/m],
// A = área de la cuenca [ha]. Salida en minutos. Cada método devuelve null si
// sus entradas no son válidas (evita NaN en la UI).

const MIN_DISENO = 10; // Piso de diseño RAS 0330 para evitar intensidades irreales.

export type MetodoTc = 'kirpich' | 'temez' | 'giandotti';

export interface TiemposTc {
  kirpich: number | null;
  temez: number | null;
  giandotti: number | null;
  /** Mediana de los métodos válidos, elevada al piso de diseño de 10 min. */
  recomendado: number | null;
  /** Método cuyo valor coincide con la mediana (antes del piso). */
  metodoRecomendado: MetodoTc | null;
  /** true si el piso de 10 min elevó el valor recomendado. */
  pisoAplicado: boolean;
}

// Kirpich (1940): Tc[min] = 0,0195·L^0,77·S^−0,385  (L en m, S en m/m).
export function kirpich(L: number, S: number): number | null {
  if (!(L > 0) || !(S > 0)) return null;
  return 0.0195 * Math.pow(L, 0.77) * Math.pow(S, -0.385);
}

// Témez (1978): Tc[h] = 0,3·(L_km / S^0,25)^0,76  → ×60 a minutos (L en km, S en m/m).
export function temez(L: number, S: number): number | null {
  if (!(L > 0) || !(S > 0)) return null;
  const Lkm = L / 1000;
  return 0.3 * Math.pow(Lkm / Math.pow(S, 0.25), 0.76) * 60;
}

// Giandotti: Tc[h] = (4·√A_km² + 1,5·L_km) / (25,3·√(S·L_km)) → ×60 (forma con pendiente).
export function giandotti(L: number, S: number, A_ha: number): number | null {
  if (!(L > 0) || !(S > 0) || !(A_ha > 0)) return null;
  const Lkm = L / 1000;
  const Akm2 = A_ha / 100;
  return ((4 * Math.sqrt(Akm2) + 1.5 * Lkm) / (25.3 * Math.sqrt(S * Lkm))) * 60;
}

export function tiemposConcentracion(L: number, S: number, A_ha: number): TiemposTc {
  const k = kirpich(L, S);
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
    const mediana = ordenado[Math.floor((ordenado.length - 1) / 2)];
    metodoRecomendado = mediana.m;
    if (mediana.v < MIN_DISENO) {
      recomendado = MIN_DISENO;
      pisoAplicado = true;
    } else {
      recomendado = mediana.v;
    }
  }

  return { kirpich: k, temez: t, giandotti: g, recomendado, metodoRecomendado, pisoAplicado };
}

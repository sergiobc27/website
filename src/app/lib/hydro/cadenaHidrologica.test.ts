import { describe, it, expect } from 'vitest';
import { tiemposConcentracion } from './tc';
import { cAjustado, qRacional, intensidadIdf, factorFrecuencia } from './runoff';
import { capacidadCircular, profundidadNormalCircular, esfuerzoCortante, chequeoSuficiencia, chequeoLlenado, chequeoCortante, chequeoVelocidadMax } from './manning';

/**
 * Test de INTEGRACIÓN de la cadena completa del método racional:
 *   Tc (Kirpich/Témez/Giandotti) -> I (curva IDF, D = Tc en minutos)
 *   -> C ajustado por Cf -> Q racional -> verificación de Manning.
 *
 * A diferencia de los tests unitarios por función (tc.test.ts, runoff.test.ts,
 * manning.test.ts), aquí se encadenan las salidas de una etapa como entrada de
 * la siguiente exactamente como lo hace CalculadoraCaudal.tsx, para cubrir el
 * CABLEADO entre etapas (no las fórmulas en sí, ya probadas por separado):
 * - la conversión de pendiente %->m/m antes de tiemposConcentracion,
 * - que la duración D de la IDF sea el Tc en MINUTOS (sin convertir a horas),
 * - que Cf se aplique una sola vez (dentro de cAjustado, no otra vez en Q),
 * - y que el Q resultante alimente Manning con sus mismas unidades (m³/s).
 *
 * Cuenca de referencia (misma que tc.test.ts): L = 800 m, S = 2%, A = 5 ha.
 * Cada número se documenta con su cálculo a mano para poder auditarlo.
 */
describe('cadena hidrológica de integración: Tc -> I -> C -> Q -> Manning', () => {
  // ── Entradas de la cuenca y de la obra ──
  const L = 800; // m
  const S_pct = 2; // % (la UI captura la pendiente en %, no en m/m)
  const A_ha = 5; // ha
  const Tr = 10; // años
  const equation = { K: 4000, m: 0.18, n: 0.85 }; // curva IDF de ejemplo
  const cBase = 0.83; // 'Distritos comerciales, centro' (INVÍAS Tabla 2.9), punto medio

  it('paso 1: Tc se calcula convirtiendo la pendiente de % a m/m; la mediana (Témez) queda por encima del piso', () => {
    const tcs = tiemposConcentracion(L, S_pct / 100, A_ha);
    // Valores a mano (ver tc.test.ts): Kirpich ≈ 15,12 min, Témez ≈ 31,95 min,
    // Giandotti ≈ 39,27 min -> mediana = Témez, sin piso (31,95 > 10 min).
    expect(tcs.kirpich).toBeCloseTo(15.12, 1);
    expect(tcs.temez).toBeCloseTo(31.95, 1);
    expect(tcs.giandotti).toBeCloseTo(39.27, 1);
    expect(tcs.recomendado).toBeCloseTo(31.95, 1);
    expect(tcs.metodoRecomendado).toBe('temez');
    expect(tcs.pisoAplicado).toBe(false);
  });

  it('paso 2: la intensidad se lee de la IDF usando el Tc EN MINUTOS como duración D (no en horas)', () => {
    const tcs = tiemposConcentracion(L, S_pct / 100, A_ha);
    const tcUsado = tcs.recomendado!;
    const intensidad = intensidadIdf(equation, Tr, tcUsado);
    // I = K·Tr^m/D^n = 4000·10^0,18 / 31,9466^0,85 ≈ 318,64 mm/h.
    // Si D se pasara en horas (÷60) por error, este número sería muy distinto.
    expect(intensidad).toBeCloseTo(318.64, 1);
  });

  it('paso 3: C se ajusta por Cf UNA sola vez (Cf(10) = 1,0 en este caso no cambia C)', () => {
    const cf = factorFrecuencia(Tr);
    const cAjust = cAjustado(cBase, Tr);
    expect(cf).toBe(1.0); // Tr ≤ 10 -> sin recargo
    expect(cAjust).toBeCloseTo(0.83, 5); // 0,83 · 1,0 = 0,83 (no 0,83 aplicado dos veces)
  });

  it('paso 4: el caudal racional Q = C·I·A/360 encadena Tc, I y C sin perder unidades', () => {
    const tcs = tiemposConcentracion(L, S_pct / 100, A_ha);
    const tcUsado = tcs.recomendado!;
    const intensidad = intensidadIdf(equation, Tr, tcUsado);
    const cAjust = cAjustado(cBase, Tr);
    const q = qRacional(cAjust, intensidad, A_ha);
    // Q = 0,83 · 318,64 · 5 / 360 ≈ 3,6732 m³/s.
    expect(q).toBeCloseTo(3.6732, 3);
  });

  it('paso 5: ese Q alimenta Manning (tubería circular D=1,2 m) y produce un veredicto verde/amarillo consistente', () => {
    const tcs = tiemposConcentracion(L, S_pct / 100, A_ha);
    const tcUsado = tcs.recomendado!;
    const intensidad = intensidadIdf(equation, Tr, tcUsado);
    const cAjust = cAjustado(cBase, Tr);
    const q = qRacional(cAjust, intensidad, A_ha);

    const D = 1.2; // m
    const nMann = 0.013; // concreto
    const sCond = 0.01; // 1%, pendiente del conducto

    const cap = capacidadCircular(D, nMann, sCond);
    const sol = profundidadNormalCircular(q, D, nMann, sCond);
    const tau = esfuerzoCortante(sol.r, sCond);

    // Cálculo a mano: qCap (tubo lleno) ≈ 3,8987 m³/s; con Q ≈ 3,6732 m³/s la
    // relación de llenado converge a y/D ≈ 0,772 (77%), R ≈ 0,364 m,
    // v ≈ 3,92 m/s y τ = γ·R·S ≈ 35,7 Pa.
    expect(cap.q).toBeCloseTo(3.8987, 2);
    expect(sol.excedeCapacidad).toBe(false);
    expect(sol.llenado).toBeCloseTo(0.772, 2);
    expect(sol.v).toBeCloseTo(3.92, 1);
    expect(tau).toBeCloseTo(35.69, 1);

    // Veredictos: suficiencia al 94% de la capacidad (amarillo, entre 90-100%);
    // llenado 77% (verde, < 85%); cortante y velocidad con margen (verde).
    const suficiencia = chequeoSuficiencia(q, cap.q);
    const llenado = chequeoLlenado(sol.llenado);
    const cortante = chequeoCortante(tau, 2.0);
    const velocidad = chequeoVelocidadMax(sol.v, 5);

    expect(suficiencia.estado).toBe('amarillo');
    expect(llenado.estado).toBe('verde');
    expect(cortante.estado).toBe('verde');
    expect(velocidad.estado).toBe('verde');
  });
});

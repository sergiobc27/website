export interface OpcionesRafaga {
  particleCount: number;
  spread: number;
  startVelocity: number;
  origin: { x: number; y: number };
  colors: string[];
  gravity: number;
  ticks: number;
  scalar: number;
}

// Paleta CUC: rojo institucional, oro, verde y amarillo de apoyo.
export const COLORES_CUC = ['#A3161A', '#C9A227', '#078930', '#FCD116'];

/**
 * Construye las ráfagas tipo fuego artificial para canvas-confetti. Con `reducido`
 * (prefers-reduced-motion) devuelve un único estallido pequeño. Pura y testeable.
 */
export function construirRafagas(reducido: boolean): OpcionesRafaga[] {
  if (reducido) {
    return [
      {
        particleCount: 18,
        spread: 50,
        startVelocity: 18,
        origin: { x: 0.5, y: 0.6 },
        colors: COLORES_CUC,
        gravity: 1,
        ticks: 90,
        scalar: 0.9,
      },
    ];
  }
  return [0.2, 0.5, 0.8].map((x) => ({
    particleCount: 80,
    spread: 360,
    startVelocity: 38,
    origin: { x, y: 0.55 },
    colors: COLORES_CUC,
    gravity: 1.1,
    ticks: 200,
    scalar: 1,
  }));
}

import { describe, it, expect } from 'vitest';
import { construirRafagas, COLORES_CUC } from './celebracion';

describe('lib/celebracion', () => {
  it('usa la paleta CUC (rojo, oro, verde, amarillo)', () => {
    expect(COLORES_CUC).toEqual(['#A3161A', '#C9A227', '#078930', '#FCD116']);
  });

  it('modo normal: varias ráfagas anchas con colores CUC', () => {
    const rafagas = construirRafagas(false);
    expect(rafagas.length).toBe(3);
    for (const r of rafagas) {
      expect(r.colors).toEqual(COLORES_CUC);
      expect(r.spread).toBe(360);
      expect(r.particleCount).toBeGreaterThanOrEqual(60);
    }
  });

  it('reducir movimiento: un solo estallido pequeño', () => {
    const rafagas = construirRafagas(true);
    expect(rafagas.length).toBe(1);
    expect(rafagas[0].particleCount).toBeLessThanOrEqual(20);
    expect(rafagas[0].spread).toBeLessThan(360);
  });
});

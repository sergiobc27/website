import { describe, expect, it } from 'vitest';
import { escenaMasVisible, validarHistoria, intensidadDeCurva, TOTAL_ESCENAS } from './historia';
import { HISTORIA_IDF } from '../data/historiaIdf';

describe('escenaMasVisible', () => {
  it('elige la sección con mayor ratio de intersección (1-indexada)', () => {
    expect(escenaMasVisible([0, 0.2, 0.8, 0.1, 0, 0, 0, 0])).toBe(3);
  });
  it('con todo en cero conserva la escena actual', () => {
    expect(escenaMasVisible([0, 0, 0, 0, 0, 0, 0, 0], 5)).toBe(5);
  });
});

describe('validarHistoria', () => {
  it('acepta el dataset embebido real', () => {
    expect(validarHistoria(HISTORIA_IDF)).toEqual([]);
  });
  it('reporta lo que falte', () => {
    const errores = validarHistoria({ ...HISTORIA_IDF, curvas: [] } as never);
    expect(errores.some((e) => e.includes('curvas'))).toBe(true);
  });
});

describe('intensidadDeCurva', () => {
  it('elige la curva del Tr más cercano y el punto exacto de la duración (fixture)', () => {
    const curvas = [
      { tr: 10, puntos: [{ durMin: 15, mmH: 80 }, { durMin: 60, mmH: 40 }] },
      { tr: 25, puntos: [{ durMin: 15, mmH: 95 }, { durMin: 60, mmH: 50 }] },
    ];
    expect(intensidadDeCurva(curvas, 20, 60)).toEqual({ tr: 25, durMin: 60, mmH: 50 });
  });
  it('funciona con el dataset embebido real (primera duración disponible)', () => {
    const dur = HISTORIA_IDF.curvas[0].puntos[0].durMin;
    const r = intensidadDeCurva(HISTORIA_IDF.curvas, 25, dur);
    expect(r).not.toBeNull();
    expect(r!.mmH).toBeGreaterThan(0);
    expect(r!.durMin).toBe(dur);
  });
});

it('TOTAL_ESCENAS es 8', () => {
  expect(TOTAL_ESCENAS).toBe(8);
});

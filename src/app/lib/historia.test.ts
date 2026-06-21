import { describe, expect, it } from 'vitest';
import { escenaMasVisible, validarHistoria, intensidadDeCurva, TOTAL_ESCENAS, aRomano, progresoLectura } from './historia';
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

describe('aRomano', () => {
  it('convierte 1-8 a numerales romanos', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8].map(aRomano)).toEqual(['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII']);
  });
  it('fuera de rango devuelve el número como texto', () => {
    expect(aRomano(0)).toBe('0');
    expect(aRomano(99)).toBe('99');
  });
});

describe('progresoLectura', () => {
  // topRelativo = top del contenedor de la historia respecto al tope del scroller
  // (0 al empezar; negativo al avanzar). alto = alto del contenedor; ventanaAlto = alto visible.
  it('es 0 al inicio (tope alineado con el scroller)', () => {
    expect(progresoLectura(0, 4000, 800)).toBe(0);
  });
  it('es 1 al final (último tramo leído)', () => {
    expect(progresoLectura(-(4000 - 800), 4000, 800)).toBe(1);
  });
  it('es 0.5 a la mitad del recorrido', () => {
    expect(progresoLectura(-(4000 - 800) / 2, 4000, 800)).toBeCloseTo(0.5, 5);
  });
  it('hace clamp por debajo de 0 y por encima de 1', () => {
    expect(progresoLectura(500, 4000, 800)).toBe(0);
    expect(progresoLectura(-99999, 4000, 800)).toBe(1);
  });
  it('si el contenido cabe entero en la ventana devuelve 1', () => {
    expect(progresoLectura(0, 600, 800)).toBe(1);
  });
});

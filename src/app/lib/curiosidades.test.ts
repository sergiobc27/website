import { describe, it, expect } from 'vitest';
import {
  seleccionarCuriosidades,
  siguienteIndice,
  ANALOGIAS_PRECIPITACION,
  CURIOSIDADES_POR_DEPARTAMENTO,
} from './curiosidades';

describe('curiosidades', () => {
  it('incluye analogias de precipitacion cuando la variable es precip', () => {
    const r = seleccionarCuriosidades({ esPrecipitacion: true, departamentos: [] });
    expect(r.length).toBeGreaterThan(0);
    expect(r.some((c) => ANALOGIAS_PRECIPITACION.includes(c))).toBe(true);
  });
  it('prioriza datos del departamento elegido si existen', () => {
    const r = seleccionarCuriosidades({ esPrecipitacion: true, departamentos: ['CHOCO'] });
    expect(r.some((c) => CURIOSIDADES_POR_DEPARTAMENTO['CHOCO'].includes(c))).toBe(true);
  });
  it('siempre devuelve algo (fallback generico) aunque no sea precip y sin depto', () => {
    expect(seleccionarCuriosidades({ esPrecipitacion: false, departamentos: [] }).length).toBeGreaterThan(0);
  });
  it('no repite indice consecutivo', () => {
    expect(siguienteIndice(0, 3, () => 0)).not.toBe(0);
    expect(siguienteIndice(2, 3, () => 0.99)).not.toBe(2);
  });
  it('con un solo elemento siguienteIndice devuelve 0', () => {
    expect(siguienteIndice(0, 1, () => 0.5)).toBe(0);
  });
});

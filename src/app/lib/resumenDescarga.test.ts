import { describe, it, expect } from 'vitest';
import { construirResumenProsa } from './resumenDescarga';

describe('construirResumenProsa', () => {
  it('arma frase natural con variable, territorio y rango', () => {
    const f = construirResumenProsa({
      variable: 'Precipitación',
      departamentos: ['CÓRDOBA'],
      anioInicio: 2015,
      anioFin: 2024,
      estaciones: 12,
    });
    expect(f).toContain('Precipitación');
    expect(f).toContain('CÓRDOBA');
    expect(f).toContain('2015');
    expect(f).toContain('2024');
    expect(f).toContain('12');
  });
  it('maneja sin departamentos', () => {
    const f = construirResumenProsa({ variable: 'Nivel', departamentos: [], anioInicio: 2003, anioFin: 2026, estaciones: 0 });
    expect(f).toContain('Nivel');
    expect(f).not.toContain('estaciones');
  });
  it('resume varios departamentos por conteo', () => {
    const f = construirResumenProsa({
      variable: 'Precipitación',
      departamentos: ['CÓRDOBA', 'SUCRE', 'BOLÍVAR'],
      anioInicio: 2010,
      anioFin: 2020,
      estaciones: 30,
    });
    expect(f).toContain('3 departamentos');
  });
});

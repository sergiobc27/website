import { describe, it, expect } from 'vitest';
import { referenciaDe } from './fuentes';

describe('fuentes — referenciaDe', () => {
  it('resuelve una referencia existente', () => {
    expect(referenciaDe('invias-drenaje-2009')?.anio).toBe(2009);
    expect(referenciaDe('ras-0330')?.anio).toBe(2017);
  });
  it('Chow Applied Hydrology (1988) está en la bibliografía', () => {
    const c = referenciaDe('chow-applied-1988');
    expect(c).toBeTruthy();
    expect(c?.apa).toMatch(/Applied Hydrology/);
  });
  it('devuelve undefined si no existe', () => {
    expect(referenciaDe('no-existe')).toBeUndefined();
  });
});

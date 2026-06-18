import { describe, it, expect } from 'vitest';
import { derivarProgreso, etaAmable } from './progresoDescarga';

describe('progresoDescarga', () => {
  it('fase planear cuando aun no hay total', () => {
    const r = derivarProgreso({ status: 'planning' } as any, 0);
    expect(r.fase).toBe('planear');
    expect(r.indeterminado).toBe(true);
  });
  it('fase descargar con porcentaje determinado', () => {
    const r = derivarProgreso({ status: 'processing', progressPercent: 40, currentPage: 4, totalPages: 12 } as any, 30);
    expect(r.fase).toBe('descargar');
    expect(r.percent).toBe(40);
    expect(r.indeterminado).toBe(false);
  });
  it('clamp monotono: nunca baja respecto al previo', () => {
    const r = derivarProgreso({ status: 'processing', progressPercent: 20 } as any, 55);
    expect(r.percent).toBe(55);
  });
  it('listo = 100', () => {
    expect(derivarProgreso({ status: 'completed' } as any, 90).percent).toBe(100);
  });
  it('eta amable en rango', () => {
    expect(etaAmable(8)).toMatch(/segundos/i);
    expect(etaAmable(75)).toMatch(/min/i);
    expect(etaAmable(null)).toBe('');
  });
});

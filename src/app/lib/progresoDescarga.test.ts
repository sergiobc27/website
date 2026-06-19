import { describe, it, expect } from 'vitest';
import { derivarProgreso, etaAmable, emaSiguiente, etaEstableSeg } from './progresoDescarga';

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

describe('suavizado de ETA', () => {
  it('emaSiguiente arranca con el primer valor', () => {
    expect(emaSiguiente(null, 100)).toBe(100);
  });
  it('emaSiguiente promedia exponencialmente (alpha 0.25)', () => {
    expect(emaSiguiente(100, 200, 0.25)).toBe(125);
  });
  it('etaEstableSeg conserva el previo si cambia <10%', () => {
    expect(etaEstableSeg(100, 105)).toBe(100);
    expect(etaEstableSeg(100, 130)).toBe(130);
  });
  it('etaEstableSeg toma el nuevo si no hay previo', () => {
    expect(etaEstableSeg(null, 90)).toBe(90);
  });
});

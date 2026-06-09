import { describe, it, expect } from 'vitest';
import { factorFrecuencia, cAjustado, qRacional, OBRAS_TR } from './runoff';

describe('factorFrecuencia (Ven Te Chow / INVÍAS)', () => {
  it('Tr ≤ 10 → 1,00', () => {
    expect(factorFrecuencia(2)).toBe(1.0);
    expect(factorFrecuencia(10)).toBe(1.0);
  });
  it('Tr = 25 → 1,10; Tr = 50 → 1,20; Tr ≥ 100 → 1,25', () => {
    expect(factorFrecuencia(25)).toBe(1.1);
    expect(factorFrecuencia(50)).toBe(1.2);
    expect(factorFrecuencia(100)).toBe(1.25);
  });
});

describe('cAjustado = min(1, C·Cf)', () => {
  it('aplica el factor de frecuencia', () => {
    expect(cAjustado(0.5, 25)).toBeCloseTo(0.55, 5);
    expect(cAjustado(0.7, 10)).toBeCloseTo(0.7, 5);
  });
  it('nunca supera 1,0', () => {
    expect(cAjustado(0.85, 100)).toBe(1.0); // 0,85·1,25 = 1,0625 → topado
  });
});

describe('qRacional = C·I·A/360', () => {
  it('caso conocido C=0,7 I=100 mm/h A=5 ha → ≈ 0,972 m³/s', () => {
    expect(qRacional(0.7, 100, 5)).toBeCloseTo(0.9722, 3);
  });
});

describe('OBRAS_TR — selector obra → Tr', () => {
  it('expone opciones con Tr sugerido y cita', () => {
    expect(OBRAS_TR.length).toBeGreaterThan(0);
    for (const o of OBRAS_TR) {
      expect(typeof o.label).toBe('string');
      expect(o.tr).toBeGreaterThan(0);
      expect(typeof o.fuente).toBe('string');
    }
  });
});

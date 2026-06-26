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

describe('OBRAS_TR — selector obra → Tr (literal a la norma)', () => {
  const por = (label: string) => OBRAS_TR.find((o) => o.label === label);

  it('todas las opciones tienen Tr > 0 y cita textual', () => {
    expect(OBRAS_TR.length).toBeGreaterThan(0);
    for (const o of OBRAS_TR) {
      expect(o.tr).toBeGreaterThan(0);
      expect(typeof o.fuente).toBe('string');
      expect(o.fuente).toMatch(/INVÍAS \(2009\), Tabla 2\.8|RAS 0330 \(2017\), Art\. 135, Tabla 16/);
    }
  });

  it('valores viales literales de la Tabla 2.8 (INVÍAS)', () => {
    expect(por('Cuneta')?.tr).toBe(5);
    expect(por('Alcantarilla de 0,90 m de diámetro')?.tr).toBe(10);
    expect(por('Alcantarilla mayor a 0,90 m de diámetro')?.tr).toBe(20);
    expect(por('Puente menor (luz < 10 m)')?.tr).toBe(25);
    expect(por('Puente (luz ≥ 50 m)')?.tr).toBe(100);
  });

  it('valores urbanos literales de la Tabla 16 (RAS Art. 135)', () => {
    expect(por('Tramo inicial residencial (< 2 ha)')?.tr).toBe(3);
    expect(por('Alcantarillado pluvial (> 10 ha)')?.tr).toBe(10);
    expect(por('Canal abierto (> 1000 ha)')?.tr).toBe(100);
  });
});

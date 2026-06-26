import { describe, it, expect } from 'vitest';
import {
  capacidadCircular,
  profundidadNormalCircular,
  profundidadNormalTrapecio,
  chequeoVelocidad,
  esfuerzoCortante,
  chequeoCortante,
  TAU_MIN_AUTOLIMPIEZA,
} from './manning';

// Caso analítico circular: D=0,5 m, n=0,013, S=0,01.
// A=πD²/4=0,19635, R=D/4=0,125, R^(2/3)=0,25 → Q=(1/n)·A·R^(2/3)·√S.
describe('capacidadCircular (tubo lleno)', () => {
  const c = capacidadCircular(0.5, 0.013, 0.01);
  it('Q a tubo lleno ≈ 0,3776 m³/s', () => {
    expect(c.q).toBeCloseTo(0.3776, 3);
  });
  it('velocidad a tubo lleno ≈ 1,923 m/s', () => {
    expect(c.v).toBeCloseTo(1.923, 2);
  });
});

describe('profundidadNormalCircular (solver por bisección)', () => {
  // A media sección (y/D=0,5) el caudal de la misma tubería es ≈ 0,1888 m³/s.
  it('recupera y/D ≈ 0,5 para Q ≈ 0,1888', () => {
    const r = profundidadNormalCircular(0.1888, 0.5, 0.013, 0.01);
    expect(r.llenado).toBeCloseTo(0.5, 2);
    expect(r.excedeCapacidad).toBe(false);
  });
  it('marca excedeCapacidad cuando Q supera el máximo práctico', () => {
    const r = profundidadNormalCircular(99, 0.5, 0.013, 0.01);
    expect(r.excedeCapacidad).toBe(true);
  });
  it('reporta el radio hidráulico R ≈ 0,125 m a media sección', () => {
    const r = profundidadNormalCircular(0.1888, 0.5, 0.013, 0.01);
    expect(r.r).toBeCloseTo(0.125, 2);
  });
});

describe('profundidadNormalTrapecio (rectangular z=0)', () => {
  // b=1 m, z=0, n=0,013, S=0,01: a y=0,5 m → Q ≈ 1,5263 m³/s.
  it('recupera y ≈ 0,5 m para Q ≈ 1,5263', () => {
    const r = profundidadNormalTrapecio(1.5263, 1, 0, 0.013, 0.01);
    expect(r.y).toBeCloseTo(0.5, 2);
    expect(r.v).toBeCloseTo(3.053, 2);
  });
  it('reporta el radio hidráulico R = A/P (b=1, y=0,5 → R ≈ 0,25)', () => {
    const r = profundidadNormalTrapecio(1.5263, 1, 0, 0.013, 0.01);
    expect(r.r).toBeCloseTo(0.25, 2);
  });
});

describe('chequeoVelocidad (autolimpieza / erosión, RAS 0330)', () => {
  it('verde dentro de rango', () => {
    expect(chequeoVelocidad(1.923, 0.75, 5).estado).toBe('verde');
  });
  it('rojo bajo la mínima de autolimpieza', () => {
    expect(chequeoVelocidad(0.5, 0.75, 5).estado).toBe('rojo');
  });
  it('rojo sobre la máxima del material', () => {
    expect(chequeoVelocidad(6, 0.75, 5).estado).toBe('rojo');
  });
});

describe('esfuerzoCortante τ = γ·R·S (RAS 0330, Art. 149)', () => {
  it('τ = 9810·R·S; R=0,125 m, S=0,01 → 12,26 Pa', () => {
    expect(esfuerzoCortante(0.125, 0.01)).toBeCloseTo(12.2625, 3);
  });
  it('devuelve 0 con entradas no válidas', () => {
    expect(esfuerzoCortante(0, 0.01)).toBe(0);
    expect(esfuerzoCortante(0.1, 0)).toBe(0);
  });
});

describe('chequeoCortante (autolimpieza por cortante, RAS Art. 149)', () => {
  it('verde si τ ≥ 2,0 Pa con margen', () => {
    expect(chequeoCortante(12.26, TAU_MIN_AUTOLIMPIEZA).estado).toBe('verde');
  });
  it('rojo si τ < 2,0 Pa', () => {
    expect(chequeoCortante(1.5, TAU_MIN_AUTOLIMPIEZA).estado).toBe('rojo');
  });
  it('amarillo si está apenas por encima del mínimo', () => {
    expect(chequeoCortante(2.1, TAU_MIN_AUTOLIMPIEZA).estado).toBe('amarillo');
  });
});

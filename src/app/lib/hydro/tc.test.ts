import { describe, it, expect } from 'vitest';
import { tiemposConcentracion } from './tc';

// Casos calculados a mano con las fórmulas de la literatura (L en m, S en m/m, A en ha).
// Cuenca de referencia: L=800 m, S=0,02 (2%), A=5 ha.
describe('tiemposConcentracion — cuenca media (L=800, S=0,02, A=5 ha)', () => {
  const r = tiemposConcentracion(800, 0.02, 5);

  it('Kirpich ≈ 15,12 min', () => {
    expect(r.kirpich).toBeCloseTo(15.12, 1);
  });

  it('Témez ≈ 31,95 min', () => {
    expect(r.temez).toBeCloseTo(31.95, 1);
  });

  it('Giandotti ≈ 39,27 min', () => {
    expect(r.giandotti).toBeCloseTo(39.27, 1);
  });

  it('recomendado = mediana de los tres (Témez)', () => {
    expect(r.recomendado).toBeCloseTo(31.95, 1);
    expect(r.metodoRecomendado).toBe('temez');
    expect(r.pisoAplicado).toBe(false);
  });
});

describe('tiemposConcentracion — piso de diseño 10 min (RAS 0330)', () => {
  // Cuenca diminuta: la mediana cae por debajo de 10 min → se aplica el piso.
  const r = tiemposConcentracion(50, 0.05, 0.5);

  it('la mediana cruda es < 10 min', () => {
    const cruda = [r.kirpich, r.temez, r.giandotti].filter((v): v is number => v != null).sort((a, b) => a - b)[1];
    expect(cruda).toBeLessThan(10);
  });

  it('recomendado se eleva a 10 min y marca pisoAplicado', () => {
    expect(r.recomendado).toBe(10);
    expect(r.pisoAplicado).toBe(true);
  });
});

describe('tiemposConcentracion — dos métodos válidos (mediana = promedio, no el menor)', () => {
  // A=0 anula Giandotti → quedan Kirpich (15,12) y Témez (31,95). La mediana de
  // un par es el promedio (≈23,5), NO el menor (15,12) como hacía el bug.
  const r = tiemposConcentracion(800, 0.02, 0);

  it('Giandotti es null y quedan dos métodos', () => {
    expect(r.giandotti).toBeNull();
    expect(r.kirpich).not.toBeNull();
    expect(r.temez).not.toBeNull();
  });

  it('recomendado ≈ promedio de los dos (23,5), no el menor', () => {
    expect(r.recomendado).toBeCloseTo(23.5, 0);
    expect(r.recomendado).not.toBeCloseTo(15.12, 1);
    expect(r.pisoAplicado).toBe(false);
  });
});

describe('tiemposConcentracion — entradas inválidas', () => {
  it('devuelve null en los métodos cuando L o S no son positivos', () => {
    const r = tiemposConcentracion(0, 0.02, 5);
    expect(r.kirpich).toBeNull();
    expect(r.recomendado).toBeNull();
  });
});

describe('tiemposConcentracion — Kirpich modificado (recorrido urbano/canal)', () => {
  it('sin factor: rural por defecto (factor 1, no modificado)', () => {
    const r = tiemposConcentracion(800, 0.02, 5);
    expect(r.factorRecorrido).toBe(1);
    expect(r.kirpichModificado).toBe(false);
    expect(r.kirpich).toBeCloseTo(15.12, 1);
  });

  it('urbano (×0,4): Kirpich = base·0,4 y marca kirpichModificado', () => {
    const r = tiemposConcentracion(800, 0.02, 5, 0.4);
    expect(r.factorRecorrido).toBe(0.4);
    expect(r.kirpichModificado).toBe(true);
    expect(r.kirpich).toBeCloseTo(6.05, 1); // 15,12 · 0,4
    // La mediana sigue siendo Témez (los métodos rurales no se ven afectados).
    expect(r.recomendado).toBeCloseTo(31.95, 1);
  });

  it('canal de concreto (×0,2): Kirpich = base·0,2', () => {
    const r = tiemposConcentracion(800, 0.02, 5, 0.2);
    expect(r.kirpich).toBeCloseTo(3.02, 1); // 15,12 · 0,2
    expect(r.kirpichModificado).toBe(true);
  });
});

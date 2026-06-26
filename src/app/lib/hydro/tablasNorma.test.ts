import { describe, it, expect } from 'vitest';
import { TABLA_C_URBANA, TABLA_C_RURAL, TABLA_CF, TABLA_TR_VIAL, TABLA_TR_URBANO } from './tablasNorma';
import { referenciaDe } from './fuentes';

describe('tablasNorma — citas válidas', () => {
  it('cada tabla cita una referencia que existe en la bibliografía', () => {
    for (const t of [TABLA_C_URBANA, TABLA_C_RURAL, TABLA_CF, TABLA_TR_VIAL, TABLA_TR_URBANO]) {
      expect(referenciaDe(t.fuente.ref)).toBeTruthy();
      expect(t.filas.length).toBeGreaterThan(0);
      expect(t.columnas.length).toBeGreaterThan(0);
    }
  });
});

describe('tablasNorma — valores literales verificados', () => {
  it('C urbano (INVÍAS Tabla 2.9): distritos comerciales centro de ciudad 0,70–0,95', () => {
    const fila = TABLA_C_URBANA.filas.find((f) => String(f[0]).includes('centro de ciudad'));
    expect(fila?.[1]).toBe('0,70 – 0,95');
  });
  it('C rural (INVÍAS Tabla 2.10): tierras cultivadas montañoso arcilloso 0,82', () => {
    const fila = TABLA_C_RURAL.filas.find((f) => String(f[0]).toLowerCase().includes('cultivadas') && String(f[0]).toLowerCase().includes('montañoso'));
    expect(fila?.[3]).toBe('0,82');
  });
  it('Cf (Chow 1988): Tr ≥ 100 → 1,25 y está marcado por confirmar', () => {
    const fila = TABLA_CF.filas.find((f) => String(f[0]).includes('100'));
    expect(fila?.[1]).toBe('1,25');
    expect(TABLA_CF.fuente.verificado).toBe(false);
  });
  it('Tr vial (INVÍAS Tabla 2.8) y urbano (RAS Tabla 16) se derivan de OBRAS_TR', () => {
    expect(TABLA_TR_VIAL.filas.some((f) => String(f[0]) === 'Cuneta' && f[1] === 5)).toBe(true);
    expect(TABLA_TR_URBANO.filas.some((f) => String(f[0]).includes('> 10 ha') && f[1] === 10)).toBe(true);
  });
});

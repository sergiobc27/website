import { describe, it, expect } from 'vitest';
import { parseNum, parseRango, fueraDeRango, pickUrbana, pickRural } from './coefC';

describe('parseNum (es-CO, coma decimal)', () => {
  it('convierte coma decimal a número', () => {
    expect(parseNum('0,83')).toBeCloseTo(0.83, 5);
  });
  it('acepta números ya numéricos', () => {
    expect(parseNum(0.5)).toBe(0.5);
  });
});

describe('parseRango (celda "lo – hi" de la tabla de la norma)', () => {
  it('en-dash con espacios (formato real de tablasNorma.ts): "0,70 – 0,95"', () => {
    const r = parseRango('0,70 – 0,95');
    expect(r.lo).toBeCloseTo(0.70, 5);
    expect(r.hi).toBeCloseTo(0.95, 5);
    expect(r.mid).toBeCloseTo(0.825, 5);
  });
  it('guion simple sin espacios: "0.30-0.50"', () => {
    const r = parseRango('0.30-0.50');
    expect(r.lo).toBeCloseTo(0.30, 5);
    expect(r.hi).toBeCloseTo(0.50, 5);
    expect(r.mid).toBeCloseTo(0.40, 5);
  });
  it('em-dash: "0,10 — 0,25"', () => {
    const r = parseRango('0,10 — 0,25');
    expect(r.lo).toBeCloseTo(0.10, 5);
    expect(r.hi).toBeCloseTo(0.25, 5);
  });
  it('valor rural sin rango (número suelto): "0,82" -> lo=hi=mid=0,82', () => {
    const r = parseRango('0,82');
    expect(r.lo).toBeCloseTo(0.82, 5);
    expect(r.hi).toBeCloseTo(0.82, 5);
    expect(r.mid).toBeCloseTo(0.82, 5);
  });
  it('acepta un número directo (no string) sin partir nada', () => {
    const r = parseRango(0.6);
    expect(r).toEqual({ lo: 0.6, hi: 0.6, mid: 0.6 });
  });
});

describe('fueraDeRango', () => {
  it('true si cBase queda por debajo del rango', () => {
    expect(fueraDeRango({ lo: 0.7, hi: 0.95, mid: 0.825 }, 0.5)).toBe(true);
  });
  it('true si cBase queda por encima del rango', () => {
    expect(fueraDeRango({ lo: 0.7, hi: 0.95, mid: 0.825 }, 1.0)).toBe(true);
  });
  it('false en los bordes exactos del rango (inclusive)', () => {
    expect(fueraDeRango({ lo: 0.7, hi: 0.95, mid: 0.825 }, 0.7)).toBe(false);
    expect(fueraDeRango({ lo: 0.7, hi: 0.95, mid: 0.825 }, 0.95)).toBe(false);
  });
  it('false dentro del rango', () => {
    expect(fueraDeRango({ lo: 0.7, hi: 0.95, mid: 0.825 }, 0.8)).toBe(false);
  });
  it('false si no hay rango activo (tabla rural, sin ajuste fino)', () => {
    expect(fueraDeRango(null, 0.5)).toBe(false);
  });
});

describe('pickUrbana (Tabla 2.9): siempre fija col=1 y toma el punto medio del rango', () => {
  it('fila 5 "Distritos comerciales, centro de ciudad" (0,70 – 0,95) -> col=1, cBase=0,825', () => {
    const { sel, cBase } = pickUrbana(5, '0,70 – 0,95');
    expect(sel).toEqual({ fila: 5, col: 1 });
    expect(cBase).toBeCloseTo(0.825, 5);
  });
  it('ignora cualquier columna que reciba (la urbana no tiene columnas por suelo)', () => {
    const { sel } = pickUrbana(2, '0,15 – 0,20');
    expect(sel.col).toBe(1);
  });
});

describe('pickRural (Tabla 2.10): respeta la columna clicada (textura del suelo)', () => {
  it('columna 3 (arcilloso) de "Tierras cultivadas, montañoso" -> col=3, cBase=0,82', () => {
    const { sel, cBase } = pickRural(6, 3, '0,82');
    expect(sel).toEqual({ fila: 6, col: 3 });
    expect(cBase).toBeCloseTo(0.82, 5);
  });
  it('columna 1 (franco arenoso) de la misma fila da un valor distinto', () => {
    const { sel, cBase } = pickRural(6, 1, '0,52');
    expect(sel).toEqual({ fila: 6, col: 1 });
    expect(cBase).toBeCloseTo(0.52, 5);
  });
});

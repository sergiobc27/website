import { describe, expect, it } from 'vitest';
import { fmt, fmtInt, formatValue } from './format';

describe('fmt', () => {
  it('formatea es-CO (coma decimal) con los decimales pedidos', () => {
    expect(fmt(1234.5, 1)).toBe('1.234,5');
    expect(fmt(0.05, 2)).toBe('0,05');
  });
  it('valores no numéricos -> guion', () => {
    expect(fmt(null)).toBe('—');
    expect(fmt(undefined)).toBe('—');
    expect(fmt(Number.NaN)).toBe('—');
  });
});

describe('fmtInt', () => {
  it('entero con miles por punto', () => {
    expect(fmtInt(764724334)).toBe('764.724.334');
  });
});

describe('formatValue', () => {
  it('no numérico -> guion', () => {
    expect(formatValue(null)).toBe('—');
    expect(formatValue(undefined)).toBe('—');
    expect(formatValue(Number.NaN)).toBe('—');
  });
  it('escala de decimales por magnitud (es-CO)', () => {
    // >= 100: 1 decimal
    expect(formatValue(1234.56)).toBe('1.234,6');
    // >= 1: 2 decimales
    expect(formatValue(12.345)).toBe('12,35');
    // < 1: 4 decimales
    expect(formatValue(0.05)).toBe('0,05');
  });
  it('millones -> notación compacta (1 decimal)', () => {
    // 764.7M en notación compacta es-CO
    expect(formatValue(764_700_000)).toMatch(/764,7\s*M/);
  });
});

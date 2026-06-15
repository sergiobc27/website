import { describe, expect, it } from 'vitest';
import {
  sumarObservaciones,
  ultimosMeses,
  matrizCalendario,
  colorCalendario,
  mesVsHistorico,
  frescuraRelativa,
} from './dashboard';

const P = (bucket: string, value: number | null) => ({ bucket, value, n: 1 });

describe('sumarObservaciones', () => {
  it('suma rowCount de todos los datasets', () => {
    expect(sumarObservaciones([{ rowCount: 100 }, { rowCount: 50 }] as never)).toBe(150);
  });
  it('vacío -> null (el caller usa copy estático)', () => {
    expect(sumarObservaciones([])).toBeNull();
  });
});

describe('ultimosMeses', () => {
  it('devuelve los últimos N puntos con etiqueta de mes', () => {
    const serie = [P('2025-11-01', 5), P('2025-12-01', 8), P('2026-01-01', 3)];
    const r = ultimosMeses(serie, 2);
    expect(r).toHaveLength(2);
    expect(r[0]).toMatchObject({ valor: 8 });
    expect(r[1].etiqueta).toMatch(/ene/i);
  });
});

describe('matrizCalendario', () => {
  it('agrupa por año con 12 huecos y null donde no hay dato', () => {
    const serie = [P('2024-01-01', 2), P('2024-03-01', 7), P('2025-12-01', 4)];
    const m = matrizCalendario(serie);
    expect(m.anios.map((a) => a.anio)).toEqual([2024, 2025]);
    expect(m.anios[0].meses[0]).toBe(2);
    expect(m.anios[0].meses[1]).toBeNull();
    expect(m.anios[0].meses[2]).toBe(7);
    expect(m.anios[1].meses[11]).toBe(4);
    expect(m.max).toBe(7);
  });
});

describe('colorCalendario', () => {
  it('null -> transparente; 0..max -> escala azul→oro', () => {
    expect(colorCalendario(null, 10)).toBe('transparent');
    expect(colorCalendario(0, 10)).not.toBe(colorCalendario(10, 10));
    expect(colorCalendario(10, 0)).toBe('transparent'); // max 0: sin escala
  });
});

describe('mesVsHistorico', () => {
  const clima = [{ month: 1, mean: 10 }] as never;
  it('calcula el % vs el promedio histórico del mismo mes', () => {
    const r = mesVsHistorico(P('2026-01-01', 12), clima);
    expect(r).toMatchObject({ pct: 20, direccion: 'arriba' });
  });
  it('sin climatología del mes o sin valor -> null', () => {
    expect(mesVsHistorico(P('2026-02-01', 12), clima)).toBeNull();
    expect(mesVsHistorico(null, clima)).toBeNull();
  });
  // Precip migrado a lámina mensual (mm/mes): el punto actual es mm/mes y la
  // referencia debe ser monthlyDepth (mismas unidades), NO el avg por lectura.
  it('prefiere monthlyDepth de la climatología cuando existe (mismas unidades mm/mes)', () => {
    const climaPrecip = [{ month: 1, mean: 0.05, monthlyDepth: 200 }] as never;
    const r = mesVsHistorico(P('2026-01-01', 250), climaPrecip);
    // 250 vs 200 -> +25% (usando monthlyDepth, no mean 0.05)
    expect(r).toMatchObject({ pct: 25, direccion: 'arriba' });
  });
  it('cae a mean cuando monthlyDepth es null/ausente (variables no-precip)', () => {
    const climaTemp = [{ month: 3, mean: 20, monthlyDepth: null }] as never;
    const r = mesVsHistorico(P('2026-03-01', 18), climaTemp);
    // 18 vs 20 -> -10%
    expect(r).toMatchObject({ pct: 10, direccion: 'abajo' });
  });
});

describe('frescuraRelativa', () => {
  it('formatea minutos/horas/días desde un instante dado', () => {
    const ahora = new Date('2026-06-11T12:00:00Z').getTime();
    expect(frescuraRelativa('2026-06-11T11:30:00Z', ahora)).toBe('hace 30 min');
    expect(frescuraRelativa('2026-06-10T12:00:00Z', ahora)).toBe('hace 24 h');
    expect(frescuraRelativa(null, ahora)).toBe('');
  });
});

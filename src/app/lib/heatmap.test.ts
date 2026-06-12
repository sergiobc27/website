import { describe, it, expect } from 'vitest';
import { matrizUnAnioMeses, matrizDiasSemana, matrizMesDias, type Dia } from './heatmap';
import type { AnalyticsTimeseriesPoint } from '../../shared/ideamContracts';

const p = (bucket: string, value: number | null): AnalyticsTimeseriesPoint => ({ bucket, value, n: 1 });

describe('matrizUnAnioMeses', () => {
  it('devuelve 12 posiciones del año pedido, null donde falta, y el max', () => {
    const r = matrizUnAnioMeses([p('2020-01', 5), p('2020-03', 10), p('2021-01', 99)], 2020);
    expect(r.meses).toHaveLength(12);
    expect(r.meses[0]).toBe(5);
    expect(r.meses[1]).toBeNull();
    expect(r.meses[2]).toBe(10);
    expect(r.max).toBe(10); // ignora 2021
  });
});

describe('matrizDiasSemana (estilo GitHub)', () => {
  it('2024: Jan 1 (lunes) cae en columna 0, fila 0; hay 53 columnas; max correcto', () => {
    const r = matrizDiasSemana([p('2024-01-01', 7), p('2024-12-31', 3)], 2024);
    expect(r.columnas[0][0]?.fecha).toBe('2024-01-01');
    expect(r.columnas[0][0]?.valor).toBe(7);
    expect(r.columnas).toHaveLength(53);
    expect(r.max).toBe(7);
    // 2024-12-31 es martes -> fila 1 en su columna
    const last = r.columnas[r.columnas.length - 1];
    const martes = last.find((d) => d?.fecha === '2024-12-31');
    expect(martes?.valor).toBe(3);
  });
  it('rellena con null los días previos a Jan 1 si el año no empieza en lunes', () => {
    // 2025-01-01 es miércoles -> fila 2; filas 0 y 1 de la col 0 son null
    const r = matrizDiasSemana([p('2025-01-01', 1)], 2025);
    expect(r.columnas[0][0]).toBeNull();
    expect(r.columnas[0][1]).toBeNull();
    expect(r.columnas[0][2]?.fecha).toBe('2025-01-01');
  });
});

describe('matrizMesDias', () => {
  it('febrero 2024 (bisiesto) tiene 29 días; Feb 1 (jueves) en fila 0 col 3', () => {
    const r = matrizMesDias([p('2024-02-01', 4), p('2024-02-29', 8)], 2024, 2);
    const dias: Dia[] = r.semanas.flat().filter((d): d is Dia => d !== null);
    expect(dias).toHaveLength(29);
    expect(r.semanas[0][3]?.fecha).toBe('2024-02-01');
    expect(r.semanas[0][0]).toBeNull();
    expect(r.max).toBe(8);
  });
});

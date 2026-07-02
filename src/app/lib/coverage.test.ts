import { describe, expect, it } from 'vitest';
import { resumirCobertura } from './coverage';
import type { CoverageReport } from '../../shared/ideamContracts';

function makeReport(overrides: Partial<CoverageReport>): CoverageReport {
  return {
    department: 'ANTIOQUIA',
    configured_variants: ['ANTIOQUIA'],
    matched: [],
    matched_rows: 0,
    unmatched_rows: 0,
    unmatched_discovered: [],
    ...overrides,
  };
}

describe('resumirCobertura', () => {
  it('agrega los departamentos seleccionados con las variantes encontradas (matched), sin duplicar', () => {
    const reports: CoverageReport[] = [
      makeReport({
        matched: [{ departamento: 'ANTIOQUIA', normalized: 'antioquia', total: 10 }],
      }),
    ];
    const result = resumirCobertura(reports, ['ANTIOQUIA']);
    expect(result.enhancedDepartments).toEqual(['ANTIOQUIA']);
    expect(result.unmatchedRows).toBe(0);
  });

  it('descubre departamentos adicionales via matched que no estaban seleccionados', () => {
    const reports: CoverageReport[] = [
      makeReport({
        matched: [
          { departamento: 'ANTIOQUIA', normalized: 'antioquia', total: 10 },
          { departamento: 'ANTIOQUIA (VARIANTE)', normalized: 'antioquia variante', total: 2 },
        ],
      }),
    ];
    const result = resumirCobertura(reports, ['ANTIOQUIA']);
    expect(result.enhancedDepartments).toEqual(['ANTIOQUIA', 'ANTIOQUIA (VARIANTE)']);
  });

  it('suma unmatched_rows de todos los reportes', () => {
    const reports: CoverageReport[] = [
      makeReport({ unmatched_rows: 3 }),
      makeReport({ unmatched_rows: 7 }),
    ];
    const result = resumirCobertura(reports, ['ANTIOQUIA']);
    expect(result.unmatchedRows).toBe(10);
  });

  it('sin reportes, conserva la seleccion original y unmatchedRows en 0', () => {
    const result = resumirCobertura([], ['ANTIOQUIA', 'CUNDINAMARCA']);
    expect(result.enhancedDepartments).toEqual(['ANTIOQUIA', 'CUNDINAMARCA']);
    expect(result.unmatchedRows).toBe(0);
  });

  it('filtra valores vacios de departamento', () => {
    const reports: CoverageReport[] = [
      makeReport({ matched: [{ departamento: '', normalized: '', total: 1 }] }),
    ];
    const result = resumirCobertura(reports, ['ANTIOQUIA']);
    expect(result.enhancedDepartments).toEqual(['ANTIOQUIA']);
  });
});

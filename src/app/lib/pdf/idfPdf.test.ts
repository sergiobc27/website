import { describe, it, expect } from 'vitest';
import { buildIdfPdfModel } from './idfPdf';
import type { IdfResponse } from '../../../shared/ideamContracts';

// Nota: renderIdfPdf (jsPDF + autotable) se valida manualmente en el navegador
// (ver plan, Task 5). jsPDF/autotable se cuelga en el entorno Node de Vitest al
// medir texto sin un DOM real, así que aquí solo cubrimos el modelo puro.

const station = { nombre: 'Apto E. Cortissoz', codigo: '29045020', municipio: 'Soledad', departamento: 'Atlántico' };

const idf: IdfResponse = {
  available: true,
  nYears: 28,
  durations: [10, 30],
  returnPeriods: [2, 10],
  curves: [
    { returnPeriod: 2, points: [
      { durMin: 10, depthMm: 12, intensityMmH: 72 },
      { durMin: 30, depthMm: 18, intensityMmH: 36 },
    ] },
    { returnPeriod: 10, points: [
      { durMin: 10, depthMm: 20, intensityMmH: 120 },
      { durMin: 30, depthMm: 30, intensityMmH: 60 },
    ] },
  ],
  equation: { K: 1234.5, m: 0.18, n: 0.72, r2: 0.987 },
  warnings: [],
};

describe('buildIdfPdfModel', () => {
  it('arma encabezado, ecuación, una fila por duración y el crédito', () => {
    const m = buildIdfPdfModel(idf, station, 'verde', new Date('2026-06-10T12:00:00Z'));
    expect(m.titulo).toBe('Curvas IDF');
    expect(m.estacionNombre).toBe('Apto E. Cortissoz · 29045020');
    expect(m.estacionUbicacion).toBe('Soledad, Atlántico');
    expect(m.chips).toContain('28 años');
    expect(m.chips).toContain('datos 10-min');
    expect(m.ecuacion).toBe('I = (K · T^m) / D^n');
    expect(m.cabecera).toEqual(['Dur. (min)', 'Tr 2a', 'Tr 10a']);
    expect(m.filas).toEqual([
      ['10', '72', '120'],
      ['30', '36', '60'],
    ]);
    expect(m.credito).toBe('Ingeniero Civil Sergio Beltrán Coley · Universidad de la Costa (CUC)');
    expect(m.filename).toBe('curva-idf-apto-e-cortissoz-2026-06-10.pdf');
  });

  it('sin ecuación deja ecuacionParams vacío', () => {
    const m = buildIdfPdfModel({ ...idf, equation: null }, station, null, new Date('2026-06-10'));
    expect(m.ecuacionParams).toBe('');
  });
});

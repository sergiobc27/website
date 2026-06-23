import { describe, expect, it } from 'vitest';
import type { FeatureCollection } from 'geojson';
import {
  VISTAS_MAPA,
  vistaPorId,
  vistasPorFamilia,
  valoresPorDane,
  contarEstacionesPorDane,
  construirFeatures,
  rangoValores,
  expresionRelleno,
} from './vistasMapa';

describe('catálogo de vistas', () => {
  it('lluvia usa precipitación con lámina mensual en mm/mes', () => {
    const v = vistaPorId('lluvia');
    expect(v).toBeDefined();
    expect(v?.datasetId).toBe('s54a-sgyg');
    expect(v?.metrica).toBe('monthlyDepth');
    expect(v?.unidad).toBe('mm/mes');
  });

  it('frío resalta los valores bajos (degradado invertido)', () => {
    expect(vistaPorId('frio')?.invertir).toBe(true);
  });

  it('ríos va marcado como datos en revisión', () => {
    expect(vistaPorId('rios')?.enRevision).toBe(true);
  });

  it('cobertura no tiene variable y cuenta el catálogo de estaciones', () => {
    const v = vistaPorId('cobertura');
    expect(v?.datasetId).toBeNull();
    expect(v?.metrica).toBe('catalogStations');
    expect(v?.unidad).toBe('estaciones');
  });

  it('toda vista con variable tiene un datasetId no vacío y una rampa de 4 colores', () => {
    for (const v of VISTAS_MAPA) {
      if (v.metrica !== 'catalogStations') expect(v.datasetId).toBeTruthy();
      expect(v.rampa).toHaveLength(4);
    }
  });

  it('id desconocido devuelve undefined', () => {
    expect(vistaPorId('no-existe')).toBeUndefined();
  });

  it('agrupa por familia Clima / Cobertura / Agua en orden', () => {
    const grupos = vistasPorFamilia();
    expect(grupos.map((g) => g.familia)).toEqual(['Clima', 'Cobertura', 'Agua']);
    expect(grupos[0].vistas.map((v) => v.id)).toEqual(['lluvia', 'calor', 'frio', 'humedad', 'viento']);
  });
});

describe('valoresPorDane', () => {
  const region = (department: string, extra: Record<string, unknown>) => ({
    department,
    rowCount: 0,
    mean: null,
    stationCount: 0,
    monthlyDepth: null,
    ...extra,
  });

  it('promedia mean ponderando por rowCount al unir variantes del mismo departamento', () => {
    const regions = [
      region('ATLANTICO', { mean: 30, rowCount: 300 }),
      region('ATLÁNTICO', { mean: 10, rowCount: 100 }),
    ];
    // (30*300 + 10*100) / 400 = 25
    expect(valoresPorDane(regions, 'mean').get('08')).toBeCloseTo(25);
  });

  it('ignora variantes con valor nulo al promediar', () => {
    const regions = [
      region('HUILA', { mean: 20, rowCount: 100 }),
      region('HUILA', { mean: null, rowCount: 500 }),
    ];
    expect(valoresPorDane(regions, 'mean').get('41')).toBeCloseTo(20);
  });

  it('usa el campo monthlyDepth para la métrica de lluvia', () => {
    const regions = [region('CHOCO', { monthlyDepth: 640, rowCount: 50 })];
    expect(valoresPorDane(regions, 'monthlyDepth').get('27')).toBeCloseTo(640);
  });

  it('suma stationCount entre variantes (no promedia)', () => {
    const regions = [
      region('NARIÑO', { stationCount: 12, rowCount: 1 }),
      region('NARINO', { stationCount: 8, rowCount: 1 }),
    ];
    expect(valoresPorDane(regions, 'stationCount').get('52')).toBe(20);
  });

  it('omite departamentos no mapeables a DANE', () => {
    const regions = [region('PAIS DE LAS MARAVILLAS', { mean: 99, rowCount: 10 })];
    expect(valoresPorDane(regions, 'mean').size).toBe(0);
  });
});

describe('contarEstacionesPorDane', () => {
  it('cuenta estaciones por departamento y descarta las no mapeables', () => {
    const stations = [
      { departamento: 'ATLANTICO' },
      { departamento: 'ATLANTICO' },
      { departamento: 'CHOCO' },
      { departamento: null },
      { departamento: 'NARNIA' },
    ];
    const m = contarEstacionesPorDane(stations);
    expect(m.get('08')).toBe(2);
    expect(m.get('27')).toBe(1);
    expect(m.size).toBe(2);
  });
});

describe('construirFeatures', () => {
  const boundaries = {
    type: 'FeatureCollection',
    features: [
      { type: 'Feature', properties: { DANE: '08', NOMBRE_DPT: 'ATLANTICO' }, geometry: { type: 'Point', coordinates: [0, 0] } },
      { type: 'Feature', properties: { DANE: '27', NOMBRE_DPT: 'CHOCO' }, geometry: { type: 'Point', coordinates: [0, 0] } },
    ],
  } as unknown as FeatureCollection;

  it('marca hasData según el departamento tenga valor o no', () => {
    const out = construirFeatures(boundaries, new Map([['08', 25]]));
    const props = out.features.map((f) => f.properties as Record<string, unknown>);
    expect(props[0]).toMatchObject({ DANE: '08', valor: 25, hasData: true });
    expect(props[1]).toMatchObject({ DANE: '27', valor: 0, hasData: false });
  });
});

describe('rangoValores', () => {
  it('devuelve el mínimo y el máximo', () => {
    expect(rangoValores([10, 30, 20])).toEqual({ min: 10, max: 30 });
  });
  it('lista vacía -> 0..0', () => {
    expect(rangoValores([])).toEqual({ min: 0, max: 0 });
  });
});

describe('expresionRelleno', () => {
  it('genera una interpolación lineal sobre el valor', () => {
    const expr = expresionRelleno(vistaPorId('lluvia')!, 0, 100);
    expect(expr[0]).toBe('interpolate');
    expect(expr[2]).toEqual(['get', 'valor']);
  });
  it('no rompe cuando min == max (tramos estrictamente crecientes)', () => {
    const expr = expresionRelleno(vistaPorId('calor')!, 5, 5) as unknown[];
    // posiciones de parada: índices 3,5,7,9
    const stops = [expr[3], expr[5], expr[7], expr[9]] as number[];
    for (let i = 1; i < stops.length; i++) expect(stops[i]).toBeGreaterThan(stops[i - 1]);
  });
});

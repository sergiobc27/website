import { describe, it, expect } from 'vitest';
import type { FeatureCollection } from 'geojson';
import { bboxDeEstaciones, bboxDeGeometria, estacionMasCercana, limiteDeDepartamento } from './geo';

const feat = (lng: number, lat: number, municipio: string, nombre = 'EST') => ({
  geometry: { coordinates: [lng, lat] as [number, number] },
  properties: { nombre, municipio, departamento: `${municipio}-DEP` },
});

describe('lib/geo estacionMasCercana', () => {
  it('elige la estación más cercana a las coordenadas', () => {
    const feats = [
      feat(-74.08, 4.61, 'Bogotá'),
      feat(-74.78, 10.96, 'Barranquilla'),
      feat(-75.56, 6.25, 'Medellín'),
    ];
    const r = estacionMasCercana({ lat: 11.0, lng: -74.8 }, feats); // junto a Barranquilla
    expect(r?.municipio).toBe('Barranquilla');
    expect(r?.departamento).toBe('Barranquilla-DEP');
  });

  it('catálogo vacío -> null', () => {
    expect(estacionMasCercana({ lat: 4, lng: -74 }, [])).toBeNull();
  });

  it('coordenadas inválidas -> null', () => {
    expect(estacionMasCercana({ lat: Number.NaN, lng: -74 }, [feat(-74, 4, 'X')])).toBeNull();
  });
});

// Límites del GeoJSON del DANE tal como vienen: nombres propios y geometría
// Polygon o MultiPolygon según el departamento.
const limites: FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { NOMBRE_DPT: 'QUINDIO', DANE: '63' },
      geometry: {
        type: 'Polygon',
        coordinates: [[[-75.9, 4.1], [-75.4, 4.1], [-75.4, 4.7], [-75.9, 4.7], [-75.9, 4.1]]],
      },
    },
    {
      type: 'Feature',
      properties: { NOMBRE_DPT: 'ARCHIPIELAGO DE SAN ANDRES PROVIDENCIA Y SANTA CATALINA', DANE: '88' },
      geometry: {
        type: 'MultiPolygon',
        coordinates: [
          [[[-81.75, 12.47], [-81.68, 12.47], [-81.68, 12.60], [-81.75, 12.60], [-81.75, 12.47]]],
          [[[-81.40, 13.30], [-81.35, 13.30], [-81.35, 13.40], [-81.40, 13.40], [-81.40, 13.30]]],
        ],
      },
    },
  ],
};

describe('lib/geo limiteDeDepartamento', () => {
  it('encuentra el departamento por DANE aunque la grafía del nombre sea otra', () => {
    // El catálogo del IDEAM dice "SAN ANDRÉS PROVIDENCIA"; el GeoJSON, la forma
    // larga sin tilde. Unir por nombre fallaría; por código, no.
    const f = limiteDeDepartamento(limites, 'SAN ANDRÉS PROVIDENCIA');
    expect((f?.properties || {}).DANE).toBe('88');
  });

  it('acepta el nombre con tilde y en minúsculas', () => {
    expect((limiteDeDepartamento(limites, 'Quindío')?.properties || {}).DANE).toBe('63');
  });

  it('departamento sin límite en el archivo -> null', () => {
    expect(limiteDeDepartamento(limites, 'AMAZONAS')).toBeNull();
  });

  it('nombre desconocido o colección vacía -> null', () => {
    expect(limiteDeDepartamento(limites, 'NO EXISTE')).toBeNull();
    expect(limiteDeDepartamento({ type: 'FeatureCollection', features: [] }, 'QUINDIO')).toBeNull();
    expect(limiteDeDepartamento(null, 'QUINDIO')).toBeNull();
  });
});

describe('lib/geo bboxDeGeometria', () => {
  it('envuelve un Polygon', () => {
    expect(bboxDeGeometria(limites.features[0].geometry)).toEqual([[-75.9, 4.1], [-75.4, 4.7]]);
  });

  it('envuelve TODAS las islas de un MultiPolygon', () => {
    // Si solo mirara el primer polígono, Providencia (13,4° N) quedaría fuera.
    expect(bboxDeGeometria(limites.features[1].geometry)).toEqual([[-81.75, 12.47], [-81.35, 13.4]]);
  });

  it('geometría vacía o ausente -> null', () => {
    expect(bboxDeGeometria({ type: 'Polygon', coordinates: [] })).toBeNull();
    expect(bboxDeGeometria(null)).toBeNull();
  });
});

describe('lib/geo bboxDeEstaciones', () => {
  it('envuelve los puntos válidos e ignora los que no tienen coordenadas', () => {
    const feats = [
      feat(-75.7, 4.5, 'Armenia'),
      feat(-75.5, 4.6, 'Calarcá'),
      { geometry: undefined, properties: { nombre: 'sin geometría', municipio: 'X', departamento: 'Y' } },
    ];
    expect(bboxDeEstaciones(feats)).toEqual([[-75.7, 4.5], [-75.5, 4.6]]);
  });

  it('una sola estación -> rectángulo degenerado en ese punto', () => {
    expect(bboxDeEstaciones([feat(-74.08, 4.61, 'Bogotá')])).toEqual([[-74.08, 4.61], [-74.08, 4.61]]);
  });

  it('sin estaciones válidas -> null', () => {
    expect(bboxDeEstaciones([])).toBeNull();
  });
});

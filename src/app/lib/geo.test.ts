import { describe, it, expect } from 'vitest';
import { estacionMasCercana } from './geo';

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

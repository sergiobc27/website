import { describe, it, expect } from 'vitest';
import { mmAreaLitros, mmPorM2, clasificarIntensidad } from './precipitacion';

describe('precipitacion', () => {
  it('1 mm sobre 1 m2 = 1 litro', () => {
    expect(mmPorM2(1)).toBe(1);
  });
  it('1 mm sobre una cancha (7140 m2) > 7000 litros', () => {
    expect(mmAreaLitros(1, 7140)).toBe(7140);
  });
  it('redondea y nunca da negativos', () => {
    expect(mmAreaLitros(-5, 100)).toBe(0);
    expect(mmAreaLitros(2.4, 100)).toBe(240);
  });
  it('clasifica intensidad segun umbrales OMM (mm/h)', () => {
    expect(clasificarIntensidad(0)).toBe('sin_lluvia');
    expect(clasificarIntensidad(1)).toBe('debil');
    expect(clasificarIntensidad(5)).toBe('moderada');
    expect(clasificarIntensidad(10)).toBe('fuerte');
    expect(clasificarIntensidad(80)).toBe('muy_fuerte');
  });
});

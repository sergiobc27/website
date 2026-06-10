import { describe, it, expect } from 'vitest';
import { slugify, buildFilename } from './chartExport';

describe('chartExport helpers', () => {
  it('slugify normaliza tildes, mayusculas y espacios', () => {
    expect(slugify('Curva IDF — Estación Socha')).toBe('curva-idf-estacion-socha');
    expect(slugify('  Niño/Niña  ')).toBe('nino-nina');
  });

  it('buildFilename arma ideam-<slug>-<fecha>.png', () => {
    const d = new Date('2026-06-10T15:00:00Z');
    expect(buildFilename(['Curva IDF', 'Socha'], d)).toBe('ideam-curva-idf-socha-2026-06-10.png');
    expect(buildFilename(['', 'Mapa'], d)).toBe('ideam-mapa-2026-06-10.png');
  });
});

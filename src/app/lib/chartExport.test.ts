import { describe, it, expect } from 'vitest';
import { slugify, buildFilename, chartLayoutMetrics } from './chartExport';

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

describe('chartLayoutMetrics — proporcional e independiente del dispositivo', () => {
  // Un contenedor de 320px de alto → plotH = 640 tras EXPORT_SCALE(2). El ancho
  // canónico (1000px CSS) → plotW = 2000. Es la geometría de la Curva IDF.
  const plotH = 640;

  it('las tipografías dependen SOLO del alto: mismo alto ⇒ mismas medidas, aunque cambie el ancho', () => {
    // Distintos anchos (p.ej. capturado en un monitor ancho vs. otro) pero mismo
    // alto: el marco debe salir idéntico → misma imagen en cualquier pantalla.
    const anchoNormal = chartLayoutMetrics(2000, plotH);
    const anchoGrande = chartLayoutMetrics(3200, plotH);
    expect(anchoGrande).toEqual(anchoNormal);
  });

  it('ata la tipografía a min(ancho, alto·2.6) para no salir gigante en plots anchos-y-bajos', () => {
    // Con alto 640, alto·2.6 = 1664 < 2000 ⇒ la referencia es el alto, no el ancho.
    const m = chartLayoutMetrics(2000, plotH);
    expect(m.ref).toBe(Math.round(plotH * 2.6));
    // En una captura angosta (ancho < alto·2.6) la referencia la fija el ancho.
    expect(chartLayoutMetrics(1000, plotH).ref).toBe(1000);
  });

  it('mantiene la jerarquía título > subtítulo ≥ leyenda ≥ pie y tamaños moderados', () => {
    const m = chartLayoutMetrics(2000, plotH);
    expect(m.titlePx).toBeGreaterThan(m.subPx);
    expect(m.subPx).toBeGreaterThanOrEqual(m.legendFont);
    expect(m.legendFont).toBeGreaterThanOrEqual(m.footerFont);
    // El título ya no es gigante: en la Curva IDF ronda 50px (antes ~76px).
    expect(m.titlePx).toBeGreaterThanOrEqual(46);
    expect(m.titlePx).toBeLessThanOrEqual(54);
  });

  it('gráficas más bajas ⇒ marco proporcionalmente más pequeño', () => {
    const alta = chartLayoutMetrics(2000, 640); // contenedor 320px
    const baja = chartLayoutMetrics(2000, 380); // contenedor 190px (SPI)
    expect(baja.titlePx).toBeLessThan(alta.titlePx);
    expect(baja.pad).toBeLessThan(alta.pad);
  });
});

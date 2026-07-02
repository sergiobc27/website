import { describe, expect, it } from 'vitest';
import { buildOptionsFromCatalogBundle } from './catalogOptions';
import type { CatalogBundleRow, CatalogFilterDefinition } from '../../shared/ideamContracts';

const definitions: CatalogFilterDefinition[] = [
  { key: 'entidad', label: 'Entidad', column: 'entidad' },
  { key: 'zona', label: 'Zona', column: 'zona', labelColumn: 'zonaNombre' },
];

const rows: CatalogBundleRow[] = [
  { entidad: 'IDEAM', zona: 'Z1', zonaNombre: 'Zona Uno', total: 10 },
  { entidad: 'IDEAM', zona: 'Z2', zonaNombre: 'Zona Dos', total: 5 },
  { entidad: 'CAR', zona: 'Z1', zonaNombre: 'Zona Uno', total: 3 },
];

describe('buildOptionsFromCatalogBundle', () => {
  it('agrupa por definicion y suma totales sin filtros seleccionados', () => {
    const result = buildOptionsFromCatalogBundle(rows, definitions, {});
    expect(result.entidad).toEqual([
      { value: 'CAR', label: 'CAR', total: 3 },
      { value: 'IDEAM', label: 'IDEAM', total: 15 },
    ]);
    expect(result.zona).toEqual([
      { value: 'Z1', label: 'Z1 - Zona Uno', total: 13 },
      { value: 'Z2', label: 'Z2 - Zona Dos', total: 5 },
    ]);
  });

  it('filtra filas cruzadas por los otros filtros seleccionados (no por si mismo)', () => {
    const result = buildOptionsFromCatalogBundle(rows, definitions, { entidad: ['CAR'] });
    // zona se calcula solo con filas donde entidad=CAR
    expect(result.zona).toEqual([{ value: 'Z1', label: 'Z1 - Zona Uno', total: 3 }]);
    // entidad no se autofiltra por su propia seleccion: sigue mostrando ambas opciones
    expect(result.entidad).toEqual([
      { value: 'CAR', label: 'CAR', total: 3 },
      { value: 'IDEAM', label: 'IDEAM', total: 15 },
    ]);
  });

  it('ignora filas con valor vacio en la columna de la definicion', () => {
    const rowsConVacio: CatalogBundleRow[] = [...rows, { entidad: '', zona: 'Z3', total: 1 }];
    const result = buildOptionsFromCatalogBundle(rowsConVacio, definitions, {});
    expect(result.entidad.map((item) => item.value)).toEqual(['CAR', 'IDEAM']);
  });

  it('devuelve objeto vacio si no hay definiciones', () => {
    expect(buildOptionsFromCatalogBundle(rows, [], {})).toEqual({});
  });
});

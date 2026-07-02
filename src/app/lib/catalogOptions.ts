// Lógica pura de construcción de opciones de catálogo a partir del "bundle"
// (filas crudas) y las definiciones de filtro. Extraída de DataExtractor.tsx
// para poder testearla sin montar el árbol de React (el componente no corre
// bajo jsdom en esta suite).
import type { CatalogBundleRow, CatalogFilterDefinition, OptionItem } from '../../shared/ideamContracts';

export function buildOptionsFromCatalogBundle(
  rows: CatalogBundleRow[],
  definitions: CatalogFilterDefinition[],
  selectedFilters: Record<string, string[]>
) {
  const byKey: Record<string, OptionItem[]> = {};

  definitions.forEach((definition) => {
    const totals = new Map<string, { label: string; total: number }>();
    rows.forEach((row) => {
      const matches = definitions.every((candidate) => {
        if (candidate.key === definition.key) return true;
        const selected = selectedFilters[candidate.key] || [];
        if (!selected.length) return true;
        return selected.includes(String(row[candidate.column] || ''));
      });
      if (!matches) return;

      const value = String(row[definition.column] || '').trim();
      if (!value) return;
      const labelValue = definition.labelColumn ? String(row[definition.labelColumn] || '').trim() : '';
      const label = labelValue ? `${value} - ${labelValue}` : value;
      const current = totals.get(value) || { label, total: 0 };
      current.total += Number(row.total || 0);
      totals.set(value, current);
    });

    byKey[definition.key] = Array.from(totals.entries())
      .map(([value, item]) => ({ value, label: item.label, total: item.total }))
      .sort((left, right) => String(left.label || left.value).localeCompare(String(right.label || right.value), 'es'));
  });

  return byKey;
}

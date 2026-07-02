import { useCallback, useEffect, useState } from 'react';
import { apiJson } from '../lib/ideamApi';
import { buildOptionsFromCatalogBundle } from '../lib/catalogOptions';
import type { CatalogBundleRow, CatalogFilterDefinition, OptionItem } from '../../shared/ideamContracts';

export type CatalogOptionStatus = 'idle' | 'loading' | 'ready' | 'warming' | 'error';

interface UseCatalogOptionsArgs {
  datasetId: string;
  selectedDepartments: string[];
  catalogDefinitions: CatalogFilterDefinition[];
}

/**
 * Estado y orquestacion de los filtros de catalogo (departamentos/entidad/zona/etc.):
 * carga del "bundle" de filas crudas por dataset+departamento, con reintento
 * mientras el cache del backend esta calentando ("warming"), y el calculo
 * derivado de opciones por filtro cruzando los demas filtros seleccionados.
 *
 * Extraido de DataExtractor.tsx sin cambio de comportamiento: mismos efectos,
 * mismo orden de fetch, mismos textos de error.
 */
export function useCatalogOptions({ datasetId, selectedDepartments, catalogDefinitions }: UseCatalogOptionsArgs) {
  const [catalogFilters, setCatalogFilters] = useState<Record<string, string[]>>({});
  const [catalogOptions, setCatalogOptions] = useState<Record<string, OptionItem[]>>({});
  const [catalogOptionStatus, setCatalogOptionStatus] = useState<Record<string, CatalogOptionStatus>>({});
  const [catalogOptionErrors, setCatalogOptionErrors] = useState<Record<string, string>>({});
  const [catalogBundleRows, setCatalogBundleRows] = useState<CatalogBundleRow[]>([]);

  const loadCatalogOptions = useCallback(async (definition: CatalogFilterDefinition, force = false, cacheOnly = false) => {
    if (!datasetId || !selectedDepartments.length) {
      setCatalogOptionErrors((current) => ({
        ...current,
        [definition.key]: 'Selecciona variable y departamento para cargar este filtro.',
      }));
      setCatalogOptionStatus((current) => ({ ...current, [definition.key]: 'error' }));
      return;
    }

    const currentStatus = catalogOptionStatus[definition.key] || 'idle';
    if (!force && (currentStatus === 'loading' || currentStatus === 'ready' || currentStatus === 'warming')) return;

    setCatalogOptionErrors((current) => {
      const next = { ...current };
      delete next[definition.key];
      return next;
    });
    setCatalogOptionStatus((current) => ({ ...current, [definition.key]: 'loading' }));

    try {
      const data = await apiJson<{ options?: OptionItem[]; cachePending?: boolean }>('/api/catalog-options', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          datasetId,
          departments: selectedDepartments,
          catalogFilters,
          attributeKey: definition.key,
          cacheOnly,
        }),
      }, `No fue posible cargar ${definition.label}.`);

      setCatalogOptions((current) => ({ ...current, [definition.key]: data.options || [] }));
      setCatalogOptionStatus((current) => ({ ...current, [definition.key]: data.cachePending ? 'warming' : 'ready' }));
    } catch {
      setCatalogOptions((current) => ({ ...current, [definition.key]: [] }));
      setCatalogOptionStatus((current) => ({ ...current, [definition.key]: 'error' }));
      setCatalogOptionErrors((current) => ({
        ...current,
        [definition.key]: `No fue posible cargar ${definition.label}. Intenta de nuevo.`,
      }));
    }
  }, [catalogFilters, catalogOptionStatus, datasetId, selectedDepartments]);

  useEffect(() => {
    // Sin guard de consentimiento (Fase 2): los catálogos se precargan durante
    // la configuración; solo la vista previa y la descarga exigen el aviso legal.
    if (!datasetId || !selectedDepartments.length || !catalogDefinitions.length) return;
    let cancelled = false;
    let retryPending = true;
    const definitions = catalogDefinitions;

    setCatalogOptionErrors({});
    setCatalogOptionStatus(Object.fromEntries(definitions.map((definition) => [definition.key, 'loading' as CatalogOptionStatus])));

    const loadCatalogBundle = async () => {
      try {
        const data = await apiJson<{ rows?: CatalogBundleRow[]; cachePending?: boolean }>('/api/catalog-bundle', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            datasetId,
            departments: selectedDepartments,
          }),
        }, 'No fue posible cargar el catálogo de filtros.');

        if (cancelled) return;
        retryPending = Boolean(data.cachePending);
        setCatalogBundleRows(data.rows || []);
        setCatalogOptionStatus(Object.fromEntries(definitions.map((definition) => [
          definition.key,
          data.cachePending ? 'warming' as CatalogOptionStatus : 'ready' as CatalogOptionStatus,
        ])));
      } catch {
        if (cancelled) return;
        retryPending = false;
        setCatalogBundleRows([]);
        setCatalogOptionStatus(Object.fromEntries(definitions.map((definition) => [definition.key, 'error' as CatalogOptionStatus])));
      }
    };

    void loadCatalogBundle();
    const retryTimer = window.setInterval(() => {
      if (!cancelled && retryPending) void loadCatalogBundle();
    }, 30000);
    return () => {
      cancelled = true;
      window.clearInterval(retryTimer);
    };
  }, [datasetId, catalogDefinitions, selectedDepartments.join('|')]);

  useEffect(() => {
    const definitions = catalogDefinitions || [];
    if (!definitions.length || !catalogBundleRows.length) {
      setCatalogOptions({});
      return;
    }
    setCatalogOptions(buildOptionsFromCatalogBundle(catalogBundleRows, definitions, catalogFilters));
  }, [catalogBundleRows, catalogFilters, catalogDefinitions]);

  // Limpia todo el estado de catalogo (usado por el reset al cambiar dataset o
  // departamento en el componente). Misma forma que el reset inline original.
  const resetCatalog = useCallback(() => {
    setCatalogFilters({});
    setCatalogOptions({});
    setCatalogOptionStatus({});
    setCatalogOptionErrors({});
    setCatalogBundleRows([]);
  }, []);

  const toggleCatalogValue = useCallback((filterKey: string, value: string) => {
    setCatalogFilters((current) => {
      const values = current[filterKey] || [];
      const nextValues = values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
      return { ...current, [filterKey]: nextValues };
    });
  }, []);

  return {
    catalogFilters,
    catalogOptions,
    catalogOptionStatus,
    catalogOptionErrors,
    catalogBundleRows,
    loadCatalogOptions,
    toggleCatalogValue,
    resetCatalog,
  };
}

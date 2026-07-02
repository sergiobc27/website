// Lógica pura de interpretación de la respuesta de /api/coverage. Extraída de
// DataExtractor.tsx para poder testearla sin montar el árbol de React.
import type { CoverageReport } from '../../shared/ideamContracts';

export interface ResumenCobertura {
  enhancedDepartments: string[];
  unmatchedRows: number;
}

/**
 * A partir de los reportes de cobertura y los departamentos seleccionados,
 * calcula: (a) la lista de departamentos "enriquecida" con las variantes que
 * el backend efectivamente encontró (matched), sin duplicados; (b) el total
 * de filas con variantes no reconocidas (unmatched), usado solo para avisar
 * al usuario (esas filas NO se descargan).
 */
export function resumirCobertura(
  reports: CoverageReport[],
  selectedDepartments: string[]
): ResumenCobertura {
  const discoveredDepartments = reports.flatMap((report) => report.matched.map((item) => item.departamento));
  const enhancedDepartments = Array.from(new Set([...selectedDepartments, ...discoveredDepartments].filter(Boolean)));
  const unmatchedRows = reports.reduce((sum, report) => sum + report.unmatched_rows, 0);
  return { enhancedDepartments, unmatchedRows };
}

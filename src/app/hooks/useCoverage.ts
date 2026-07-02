import { useCallback, useState } from 'react';
import { apiJson } from '../lib/ideamApi';
import { resumirCobertura } from '../lib/coverage';
import type { CoverageReport } from '../../shared/ideamContracts';

type LogLevel = 'INFO' | 'SUCCESS' | 'ERROR';

interface UseCoverageArgs {
  appendLog: (type: LogLevel, message: string) => void;
  setActiveTask: (value: string) => void;
}

/**
 * Validacion de cobertura territorial (`/api/coverage`) antes de una
 * descarga: reporta variantes de nombre de departamento detectadas en los
 * datos y devuelve el payload de ejecucion "enriquecido" con los
 * departamentos que el backend efectivamente encontro.
 *
 * Extraido de DataExtractor.tsx sin cambio de comportamiento: mismos textos
 * de log y misma forma de retorno.
 */
export function useCoverage({ appendLog, setActiveTask }: UseCoverageArgs) {
  const [coverageReports, setCoverageReports] = useState<CoverageReport[]>([]);
  const [coverageLoading, setCoverageLoading] = useState(false);

  const validateCoverageForDownload = useCallback(async <T extends { departments: string[] }>(executionPayload: T) => {
    setCoverageLoading(true);
    setActiveTask('Validando cobertura territorial...');
    appendLog('INFO', 'Validando cobertura territorial antes de descargar...');
    try {
      const data = await apiJson<{ reports?: CoverageReport[] }>('/api/coverage', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(executionPayload),
      }, 'No fue posible validar la cobertura territorial.');

      const reports = data.reports || [];
      setCoverageReports(reports);

      const { enhancedDepartments, unmatchedRows } = resumirCobertura(reports, executionPayload.departments);

      if (unmatchedRows > 0) {
        appendLog(
          'INFO',
          `Cobertura con variantes nuevas: ${unmatchedRows.toLocaleString('es-CO')} variante(s) potenciales se reportan para revision, pero solo se descargan departamentos validados.`
        );
      } else {
        appendLog('SUCCESS', 'Cobertura territorial validada sin variantes pendientes.');
      }

      return {
        ...executionPayload,
        departments: enhancedDepartments,
      };
    } finally {
      setCoverageLoading(false);
    }
  }, [appendLog, setActiveTask]);

  return {
    coverageReports,
    coverageLoading,
    validateCoverageForDownload,
  };
}

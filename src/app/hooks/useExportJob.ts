import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, apiJson } from '../lib/ideamApi';
import type { ExportJobStatusResponse } from '../../shared/ideamContracts';

const ACTIVE_JOB_KEY = 'ideam-extractor-active-job';

export interface TransferProgress {
  totalPages: number;
  completedPages: number;
  totalRows: number;
  downloadedRows: number;
  totalParts: number;
  completedParts: number;
}

type LogLevel = 'INFO' | 'SUCCESS' | 'ERROR';

interface UseExportJobArgs {
  appendLog: (type: LogLevel, message: string) => void;
  finalizeCompletedJob: (job: ExportJobStatusResponse) => Promise<void>;
  setIsBusy: (value: boolean) => void;
  setProgress: (value: number) => void;
  setActiveTask: (value: string) => void;
  setOperationStartedAt: (value: number | null) => void;
}

/**
 * Creacion (por parte del componente, via startJob) y seguimiento del job de
 * exportacion: persistencia del job activo en localStorage (sobrevive
 * recargas), reconexion al montar y el polling con backoff que consulta
 * `/api/jobs/:id` hasta que el job termina, falla o expira.
 *
 * Extraido de DataExtractor.tsx sin cambio de comportamiento: mismos tiempos
 * de backoff, mismos mensajes de log, mismo timeout duro de 30 min. isBusy,
 * progress y activeTask se mantienen fuera del hook porque el componente los
 * comparte con los flujos de vista previa y validacion de cobertura.
 */
export function useExportJob({
  appendLog,
  finalizeCompletedJob,
  setIsBusy,
  setProgress,
  setActiveTask,
  setOperationStartedAt,
}: UseExportJobArgs) {
  const [currentJob, setCurrentJob] = useState<ExportJobStatusResponse | null>(null);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [transferProgress, setTransferProgress] = useState<TransferProgress | null>(null);
  const handledJobIdsRef = useRef<Set<string>>(new Set());
  const pollFailuresRef = useRef(0);

  // El job activo sobrevive recargas: un export de 10+ min no debe perderse
  // porque el usuario recargó la página (el ZIP vive 1h en el servidor).
  useEffect(() => {
    try {
      if (currentJobId) window.localStorage.setItem(ACTIVE_JOB_KEY, currentJobId);
      else window.localStorage.removeItem(ACTIVE_JOB_KEY);
    } catch {
      // best-effort
    }
  }, [currentJobId]);

  useEffect(() => {
    try {
      const savedJobId = window.localStorage.getItem(ACTIVE_JOB_KEY);
      if (savedJobId) {
        appendLog('INFO', `Reconectando con la exportación en curso (${savedJobId.slice(0, 8)}...).`);
        setIsBusy(true);
        setOperationStartedAt(performance.now());
        setCurrentJobId(savedJobId);
      }
    } catch {
      // best-effort
    }
    // Solo al montar: re-engancha el polling si había un job activo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!currentJobId) return undefined;

    let cancelled = false;
    let timer: number | undefined;
    const pollStartedAt = Date.now();

    // Backoff: 2s el primer minuto, 5s hasta los 5 min, 10s después. Evita
    // martillar la API (y el rate limit de lecturas) en exports largos.
    const nextDelay = () => {
      const elapsed = Date.now() - pollStartedAt;
      if (elapsed < 60_000) return 2_000;
      if (elapsed < 300_000) return 5_000;
      return 10_000;
    };

    const schedule = () => {
      if (cancelled) return;
      timer = window.setTimeout(() => void pollJob(), nextDelay());
    };

    const pollJob = async () => {
      // Timeout duro de cliente: el job puede seguir en el servidor, pero la
      // UI no debe quedarse consultando para siempre.
      if (Date.now() - pollStartedAt > 30 * 60_000) {
        setIsBusy(false);
        setCurrentJobId(null);
        setActiveTask('La exportación continúa en el servidor');
        appendLog(
          'INFO',
          'Se dejó de consultar el job tras 30 minutos. Si terminó, el ZIP aparecerá disponible al reintentar desde el historial.'
        );
        return;
      }
      try {
        const data = await apiJson<ExportJobStatusResponse>(
          `/api/jobs/${currentJobId}`,
          undefined,
          'No fue posible consultar el estado del job.'
        );
        if (cancelled) return;

        pollFailuresRef.current = 0;
        setCurrentJob(data);
        setTransferProgress({
          totalPages: Math.max(data.totalPages, 1),
          completedPages: data.completedPages,
          totalRows: data.rowCount,
          downloadedRows: data.processedRows,
          totalParts: 1,
          completedParts: data.parts.length,
        });

        if (data.status === 'queued' || data.status === 'planning') {
          setIsBusy(true);
          setProgress(data.progressPercent);
          setActiveTask(data.currentStage);
          schedule();
        } else if (data.status === 'retrying') {
          setIsBusy(true);
          setProgress(data.progressPercent);
          setActiveTask(`${data.currentStage} (${data.retryCount}/${data.retryLimit})`);
          schedule();
        } else if (data.status === 'processing') {
          setIsBusy(true);
          setProgress(data.progressPercent);
          setActiveTask(`${data.currentStage}: página ${data.currentPage}/${Math.max(data.totalPages, 1)}`);
          schedule();
        } else if (data.status === 'completed') {
          setProgress(100);
          setActiveTask('ZIP listo para descargar');
          setIsBusy(false);
          // Dedup: un job completado solo se finaliza una vez (evita duplicar
          // el historial si el efecto vuelve a correr antes de limpiar el id).
          if (!handledJobIdsRef.current.has(data.jobId)) {
            handledJobIdsRef.current.add(data.jobId);
            await finalizeCompletedJob(data);
          }
          // Limpia el job activo (y su persistencia): si no, una recarga
          // posterior re-finalizaría el job y duplicaría el historial.
          setCurrentJobId(null);
        } else if (data.status === 'failed') {
          setProgress(100);
          setActiveTask('Error en descarga');
          setIsBusy(false);
          setCurrentJobId(null);
          appendLog('ERROR', data.error || 'El job de exportación falló.');
        } else {
          schedule();
        }
      } catch (error) {
        if (cancelled) return;
        // 404/410 = el job ya no existe (expiró o se barrió tras un reinicio):
        // es DEFINITIVO, no transitorio — cortar de inmediato con mensaje claro
        // en vez de 5 reintentos + error de red genérico (auditoría #4). Los
        // reintentos quedan solo para 502/503/504 puntuales del proxy.
        if (error instanceof ApiError && (error.status === 404 || error.status === 410)) {
          setIsBusy(false);
          setCurrentJobId(null);
          setActiveTask('La exportación ya no esta disponible');
          appendLog('ERROR', 'La exportación expiró o se interrumpió en el servidor. Genera una nueva.');
          return;
        }
        // Un 502/524 puntual del proxy NO significa que el job murió: seguir
        // ocupado y reintentar; solo rendirse tras varios fallos seguidos.
        pollFailuresRef.current += 1;
        if (pollFailuresRef.current >= 5) {
          setIsBusy(false);
          setCurrentJobId(null);
          setActiveTask('No fue posible consultar el job');
          appendLog('ERROR', error instanceof Error ? error.message : 'Error consultando el job.');
        } else {
          appendLog(
            'INFO',
            `Fallo transitorio consultando el job (${pollFailuresRef.current}/5); reintentando...`
          );
          schedule();
        }
      }
    };

    void pollJob();

    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [currentJobId, finalizeCompletedJob, appendLog, setActiveTask, setIsBusy, setProgress]);

  // Resetea el estado local antes de crear un job nuevo (usado por runDownload).
  const resetForNewAttempt = useCallback(() => {
    setCurrentJob(null);
    setCurrentJobId(null);
    setTransferProgress(null);
    pollFailuresRef.current = 0;
  }, []);

  // Registra el job recien creado por el backend (usado por runDownload tras el POST a /api/jobs).
  const startJob = useCallback((data: ExportJobStatusResponse) => {
    handledJobIdsRef.current.delete(data.jobId);
    setCurrentJobId(data.jobId);
    setCurrentJob(data);
    setTransferProgress({
      totalPages: Math.max(data.totalPages, 1),
      completedPages: data.completedPages,
      totalRows: data.rowCount,
      downloadedRows: data.processedRows,
      totalParts: 1,
      completedParts: data.parts.length,
    });
  }, []);

  // Cancela la espera del cliente (usado por cancelarEspera en el componente).
  const cancelJob = useCallback(() => {
    setCurrentJobId(null);
    setCurrentJob(null);
    setTransferProgress(null);
  }, []);

  return {
    currentJob,
    currentJobId,
    transferProgress,
    setCurrentJob,
    setCurrentJobId,
    setTransferProgress,
    resetForNewAttempt,
    startJob,
    cancelJob,
  };
}

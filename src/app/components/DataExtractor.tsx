import { lazy, Suspense, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Database,
  Download,
  FileArchive,
  FileSearch,
  Filter,
  Gauge,
  Info,
  Layers,
  Link2,
  LoaderCircle,
  MapPin,
  Rocket,
  Search,
  ShieldCheck,
  TimerReset,
} from 'lucide-react';
import { toast } from 'sonner';
import { EmptyState } from './EmptyState';
import { CuriosidadEspera } from './CuriosidadEspera';
import { SlideToAccept } from './SlideToAccept';
import { ApiError, apiJson, apiUrl } from '../lib/ideamApi';
import { fmt } from '../lib/format';
import { construirResumenProsa } from '../lib/resumenDescarga';
import { etaAmable } from '../lib/progresoDescarga';
import { canDownloadAgain, type HistoryEntry, readHistory, saveHistory } from '../lib/downloadHistory';
import { NAVIGATE_EVENT, pathToView, type NavigateDetail } from '../lib/navigation';
import { buildSearch, parseSearch } from '../lib/urlState';

// Mapa (MapLibre) diferido: solo se descarga al abrir el selector en mapa.
const MapaSelectorDepartamentos = lazy(() => import('./MapaSelectorDepartamentos'));
import type {
  CatalogBundleRow,
  CatalogFilterDefinition,
  CoverageReport,
  DateRangeResponse,
  DatasetMeta,
  DownloadMetrics,
  ExportJobPart,
  ExportJobStatusResponse,
  ExportPageResponse,
  ExportPlanResponse,
  MetaResponse,
  OptionItem,
  OutputFormat,
  PreviewResponse,
  StationHelperRow,
} from '../../shared/ideamContracts';

const CONFIG_KEY = 'ideam-extractor-config';
const ACTIVE_JOB_KEY = 'ideam-extractor-active-job';
const MAX_OPERATION_LOGS = 80;
const EXPORT_AVAILABILITY_MS = 60 * 60 * 1000;
const EXPORT_PLAN_FAST_TIMEOUT_MS = 2500;

type StepId = 'variable' | 'territory' | 'advanced' | 'time' | 'execute';

const STEP_IDS: StepId[] = ['variable', 'territory', 'advanced', 'time', 'execute'];

interface StoredExtractorConfig {
  acceptedTerms?: boolean;
  step?: StepId;
  datasetId?: string;
  selectedDepartments?: string[];
  selectedFormats?: OutputFormat[];
  timeMode?: TimeMode;
}

// Persist only the configuration inputs that survive the component's mount-time
// reset effects (catalog filters, station text and dates are intentionally not
// restored because they are cleared/recomputed on load). This keeps a browser
// reload from wiping the user's variable, territory and format selections.
function loadStoredConfig(): StoredExtractorConfig {
  try {
    const raw = window.localStorage.getItem(CONFIG_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as StoredExtractorConfig;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}
type LogLevel = 'INFO' | 'SUCCESS' | 'ERROR';
type TimeMode = 'full' | 'custom';
type CatalogOptionStatus = 'idle' | 'loading' | 'ready' | 'warming' | 'error';
type ProgressStatusKind = 'idle' | 'running' | 'done' | 'error';

interface TransferProgress {
  totalPages: number;
  completedPages: number;
  totalRows: number;
  downloadedRows: number;
  totalParts: number;
  completedParts: number;
}

export interface ExtractorRuntimeState {
  isBusy: boolean;
  activeTask: string;
  progress: number;
  elapsedMs: number;
  downloadedRows: number;
  totalRows: number;
}


function formatDateLabel(value: string | null | undefined) {
  if (!value) return 'Sin dato';
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleString('es-CO');
}

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '0 B';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${fmt(value / 1024, 1)} KB`;
  return `${fmt(value / (1024 * 1024), 2)} MB`;
}

function formatDuration(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '0 s';
  if (value < 60000) return `${fmt(value / 1000, value < 10000 ? 1 : 0)} s`;

  const totalSeconds = Math.round(value / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
}

function formatRowsPerSecond(value: number) {
  if (!Number.isFinite(value) || value <= 0) return 'Calculando';
  return `${Math.round(value).toLocaleString('es-CO')} filas/s`;
}

function progressLabel(value: number) {
  return `${Math.max(0, Math.min(100, Math.round(value)))}%`;
}

// Cuenta regresiva mm:ss (o h:mm:ss si pasa de una hora) para la ventana de
// descarga del ZIP.
function formatCountdown(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${minutes}:${ss}`;
}

// Tick de 1 s hacia una fecha objetivo (ISO). Devuelve los ms restantes (≥0) o
// null si no hay objetivo válido. Sirve para la ventana real de 1 h del ZIP.
function useCountdown(targetIso: string | null | undefined) {
  const [remainingMs, setRemainingMs] = useState<number | null>(null);
  useEffect(() => {
    if (!targetIso) {
      setRemainingMs(null);
      return undefined;
    }
    const target = new Date(targetIso).valueOf();
    if (Number.isNaN(target)) {
      setRemainingMs(null);
      return undefined;
    }
    const tick = () => setRemainingMs(Math.max(0, target - Date.now()));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [targetIso]);
  return remainingMs;
}

function parseStationCodes(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[,\n;]/)
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
}

async function getFastExportPlan(payload: unknown) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), EXPORT_PLAN_FAST_TIMEOUT_MS);
  try {
    return await apiJson<ExportPlanResponse>('/api/export-plan', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    }, 'No fue posible estimar el volumen de descarga.');
  } finally {
    window.clearTimeout(timeout);
  }
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function buildOptionsFromCatalogBundle(
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

// (El armado de CSV/resúmenes en el navegador, de la era síncrona, se eliminó:
// el backend genera los archivos desde el cutover al espejo propio.)

export function DataExtractor({ onRuntimeChange }: { onRuntimeChange?: (state: ExtractorRuntimeState) => void }) {
  const [storedConfig] = useState<StoredExtractorConfig>(loadStoredConfig);
  const [meta, setMeta] = useState<MetaResponse | null>(null);
  const [step, setStep] = useState<StepId>(
    storedConfig.step && STEP_IDS.includes(storedConfig.step) ? storedConfig.step : 'variable'
  );
  // Sección abierta del acordeón "todo-en-uno" (Fase 2). Reemplaza la navegación
  // por pasos: el usuario abre/cierra cada sección de configuración a voluntad.
  const [openSection, setOpenSection] = useState<StepId | null>('variable');
  const [acceptedTerms, setAcceptedTerms] = useState(Boolean(storedConfig.acceptedTerms));
  const [datasetId, setDatasetId] = useState(typeof storedConfig.datasetId === 'string' ? storedConfig.datasetId : '');
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>(
    Array.isArray(storedConfig.selectedDepartments) ? storedConfig.selectedDepartments : []
  );
  const [catalogFilters, setCatalogFilters] = useState<Record<string, string[]>>({});
  const [catalogOptions, setCatalogOptions] = useState<Record<string, OptionItem[]>>({});
  const [catalogOptionStatus, setCatalogOptionStatus] = useState<Record<string, CatalogOptionStatus>>({});
  const [catalogOptionErrors, setCatalogOptionErrors] = useState<Record<string, string>>({});
  const [catalogBundleRows, setCatalogBundleRows] = useState<CatalogBundleRow[]>([]);
  const [stationCodesText, setStationCodesText] = useState('');
  const [stationHelperRows, setStationHelperRows] = useState<StationHelperRow[]>([]);
  const [stationHelperLoading, setStationHelperLoading] = useState(false);
  const [coverageReports, setCoverageReports] = useState<CoverageReport[]>([]);
  const [coverageLoading, setCoverageLoading] = useState(false);
  const [dateRange, setDateRange] = useState<DateRangeResponse | null>(null);
  const [timeMode, setTimeMode] = useState<TimeMode>(storedConfig.timeMode === 'custom' ? 'custom' : 'full');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedFormats, setSelectedFormats] = useState<OutputFormat[]>(
    Array.isArray(storedConfig.selectedFormats) && storedConfig.selectedFormats.length ? storedConfig.selectedFormats : ['csv']
  );
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [downloadMetrics, setDownloadMetrics] = useState<DownloadMetrics | null>(null);
  const [currentJob, setCurrentJob] = useState<ExportJobStatusResponse | null>(null);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [transferProgress, setTransferProgress] = useState<TransferProgress | null>(null);
  const [logs, setLogs] = useState<Array<{ type: LogLevel; message: string }>>([]);
  const [isBusy, setIsBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [activeTask, setActiveTask] = useState('Esperando configuración');
  const [operationStartedAt, setOperationStartedAt] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [animatedRows, setAnimatedRows] = useState(0);
  // Se incrementa al guardar una descarga para refrescar el centro de descargas
  // inline (que lee del historial local).
  const [historyTick, setHistoryTick] = useState(0);
  // Estimación en vivo (debounced) del volumen antes de descargar.
  const [liveEstimate, setLiveEstimate] = useState<ExportPlanResponse | null>(null);
  const [estimating, setEstimating] = useState(false);
  const handledJobIdsRef = useRef<Set<string>>(new Set());
  const pollFailuresRef = useRef(0);
  // Restore de deep-link del Asistente: estación/años que deben aplicarse una
  // vez que el cambio de variable/departamento se asentó y su rango temporal
  // cargó (los efectos de reset limpian estación y reescriben fechas antes).
  const pendingRestoreRef = useRef<{ est?: string; years?: string } | null>(null);
  // Dataset al que pertenece el `dateRange` actual: evita aplicar años contra
  // un rango viejo en mitad de un cambio de variable (fetch async).
  const dateRangeForRef = useRef<string>('');
  // Espejo de aplicarDeepLink para que el listener del evento (deps []) llame
  // siempre a la versión con el estado más reciente sin re-suscribirse.
  const aplicarDeepLinkRef = useRef<(params: Record<string, string>) => void>(() => {});

  // Secciones de configuración del acordeón "todo-en-uno" (Fase 2). El
  // consentimiento (barra no-bloqueante) y la ejecución (CTA) viven fuera del
  // acordeón.
  const accordionSections = useMemo(
    () => [
      { id: 'variable' as StepId, title: 'Variable', icon: Database },
      { id: 'territory' as StepId, title: 'Territorio', icon: MapPin },
      { id: 'advanced' as StepId, title: 'Filtros avanzados', icon: Filter },
      { id: 'time' as StepId, title: 'Temporalidad', icon: Calendar },
    ],
    []
  );

  const selectedDataset = useMemo(
    () => meta?.datasets.find((dataset) => dataset.id === datasetId) || null,
    [meta, datasetId]
  );

  const executionPayload = useMemo(() => {
    return {
      datasetId,
      departments: selectedDepartments,
      catalogFilters,
      stationCodes: parseStationCodes(stationCodesText),
      startDate,
      endDate,
    };
  }, [catalogFilters, datasetId, endDate, selectedDepartments, startDate, stationCodesText]);

  const selectionSummary = useMemo(() => {
    const advancedSelections = (meta?.catalogFilters || [])
      .map((item) => ({ label: item.label, values: catalogFilters[item.key] || [] }))
      .filter((item) => item.values.length);
    return {
      departments: selectedDepartments.join(', ') || 'Sin selección',
      advancedSelections,
      stationCodes: parseStationCodes(stationCodesText),
      formats: selectedFormats,
    };
  }, [catalogFilters, meta?.catalogFilters, selectedDepartments, selectedFormats, stationCodesText]);

  const previewColumns = preview?.rows.length ? Object.keys(preview.rows[0]) : [];

  const appendLog = useCallback((type: LogLevel, message: string) => {
    setLogs((current) => {
      const last = current[current.length - 1];
      if (last?.type === type && last.message === message) {
        return current;
      }
      return [...current.slice(-(MAX_OPERATION_LOGS - 1)), { type, message }];
    });
  }, []);

  // Aplica estación (un código en el textarea) y años del deep-link. Los años
  // (formato "aaaa-aaaa") activan modo personalizado y se clampan al rango
  // disponible. Solo usa setters estables → callback estable.
  const aplicarEstYears = useCallback((est?: string, years?: string, rango?: DateRangeResponse | null) => {
    if (est) setStationCodesText(est);
    const m = years ? /^(\d{4})-(\d{4})$/.exec(years) : null;
    if (m) {
      const desdeReq = `${m[1]}-01-01`;
      const hastaReq = `${m[2]}-12-31`;
      const lo = rango?.startDate || desdeReq;
      const hi = rango?.endDate || hastaReq;
      setTimeMode('custom');
      setStartDate(desdeReq < lo ? lo : desdeReq);
      setEndDate(hastaReq > hi ? hi : hastaReq);
    }
  }, []);

  // Precarga los filtros desde un deep-link ({var,dep,est,years}). El Asistente
  // envía un solo `dep`; "Compartir configuración" puede enviar varios separados
  // por coma (retrocompatible: un valor sin coma = arreglo de uno). Si var/dep
  // cambian, los efectos de reset limpiarán estación y recargarán el rango →
  // estación/años quedan pendientes y se aplican cuando el nuevo rango llega
  // (efecto de abajo). No tocamos el aviso legal.
  const aplicarDeepLink = (params: Record<string, string>) => {
    if (!params || !(params.var || params.dep || params.est || params.years)) return;
    const depList = params.dep
      ? Array.from(new Set(params.dep.split(',').map((item) => item.trim()).filter(Boolean)))
      : [];
    const datasetCambia = Boolean(params.var) && params.var !== datasetId;
    const depCambia =
      depList.length > 0 &&
      !(selectedDepartments.length === depList.length && depList.every((item) => selectedDepartments.includes(item)));
    if (params.var) setDatasetId(params.var);
    if (depList.length) setSelectedDepartments(depList);
    if (datasetCambia || depCambia) {
      pendingRestoreRef.current = { est: params.est, years: params.years };
    } else {
      aplicarEstYears(params.est, params.years, dateRange);
    }
    if (acceptedTerms) setStep('execute');
    appendLog('INFO', 'Filtros precargados desde el enlace compartido.');
  };
  aplicarDeepLinkRef.current = aplicarDeepLink;

  const triggerBrowserDownload = useCallback(async (downloadPath: string, fileName: string) => {
    // Sonda HEAD antes del <a download>: si el ZIP expiró (410/404), el error
    // se muestra EN la app en vez de una página cruda del servidor. La
    // descarga real sigue siendo streaming nativo del navegador (un fetch a
    // blob cargaría hasta 2GB en memoria).
    try {
      const probe = await fetch(downloadPath, { method: 'HEAD', cache: 'no-store' });
      if (probe.status === 410 || probe.status === 404) {
        appendLog('ERROR', 'El ZIP expiró en el servidor (la ventana de descarga es de 1 hora). Genera una nueva exportación.');
        return false;
      }
    } catch {
      // Sonda fallida por red: se intenta la descarga de todas formas.
    }
    const link = document.createElement('a');
    link.href = downloadPath;
    link.download = fileName;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
    return true;
  }, [appendLog]);

  const downloadJobPart = useCallback(async (job: ExportJobStatusResponse, part: ExportJobPart) => {
    const started = await triggerBrowserDownload(apiUrl(part.downloadPath), part.fileName);
    if (started) {
      appendLog('SUCCESS', `Descarga iniciada: ${part.fileName}. El enlace seguira disponible durante 1 hora.`);
    }
  }, [appendLog, triggerBrowserDownload]);

  const finalizeCompletedJob = useCallback(async (job: ExportJobStatusResponse) => {
    if (handledJobIdsRef.current.has(job.jobId)) return;
    handledJobIdsRef.current.add(job.jobId);

    Array.from(new Set(job.warnings)).forEach((warning) => appendLog('INFO', warning));

    if (job.metrics) {
      const firstPart = job.parts[0];
      const finishedAtMs = job.finishedAt ? new Date(job.finishedAt).valueOf() : Date.now();
      const availableUntil = firstPart?.expiresAt || new Date(finishedAtMs + EXPORT_AVAILABILITY_MS).toISOString();
      setDownloadMetrics(job.metrics);
      saveHistory({
        timestamp: new Date().toLocaleString('es-CO'),
        variable: selectedDataset?.name || datasetId,
        format: `JOB (${job.effectiveFormats.join(', ').toUpperCase()})`,
        departments: selectedDepartments,
        catalogFilters,
        jobId: job.jobId,
        downloadPath: firstPart?.downloadPath,
        availableUntil,
        ...job.metrics,
      });
      setHistoryTick((tick) => tick + 1);
    }

    appendLog(
      job.processedRows > 0 ? 'SUCCESS' : 'INFO',
      job.processedRows > 0
        ? `Job listo: ZIP único organizado, ${job.processedRows.toLocaleString('es-CO')} filas y ${formatDuration(job.metrics?.processingMs || 0)}. Usa el boton de descarga para guardarlo.`
        : 'La consulta no encontró filas con esos filtros. Se generó un ZIP con archivos vacíos para dejar evidencia de la ejecución.'
    );
  }, [appendLog, catalogFilters, datasetId, selectedDataset?.name, selectedDepartments]);

  useEffect(() => {
    const boot = async () => {
      appendLog('INFO', 'Cargando metadata operativa del sistema...');
      try {
        const data = await apiJson<MetaResponse>('/api/meta', undefined, 'No fue posible cargar la metadata.');
        setMeta(data);
        // Keep a restored dataset selection if it is still valid; otherwise default
        // to the first available dataset.
        setDatasetId((current) =>
          current && data.datasets.some((dataset) => dataset.id === current) ? current : data.datasets[0]?.id || ''
        );
        appendLog('SUCCESS', 'Metadata cargada correctamente.');
      } catch (error) {
        appendLog('ERROR', error instanceof Error ? error.message : 'Error cargando metadata.');
      }
    };
    void boot();
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        CONFIG_KEY,
        JSON.stringify({ acceptedTerms, step, datasetId, selectedDepartments, selectedFormats, timeMode })
      );
    } catch {
      // Ignore storage quota/availability errors; persistence is best-effort.
    }
  }, [acceptedTerms, step, datasetId, selectedDepartments, selectedFormats, timeMode]);

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
  }, []);

  useEffect(() => {
    // cancelled evita que la respuesta lenta del dataset ANTERIOR pise las
    // fechas del nuevo (race al cambiar rápido de variable).
    let cancelled = false;
    const loadDateRange = async () => {
      if (!datasetId) return;
      appendLog('INFO', 'Consultando rango temporal disponible...');
      try {
        const data = await apiJson<DateRangeResponse>(
          `/api/date-range?datasetId=${encodeURIComponent(datasetId)}`,
          undefined,
          'No fue posible cargar el rango temporal.'
        );
        if (cancelled) return;
        dateRangeForRef.current = datasetId;
        setDateRange(data);
        setStartDate(data.startDate || '');
        setEndDate(data.endDate || '');
        appendLog('SUCCESS', `Rango temporal disponible: ${data.startYear || 'N/D'} - ${data.endYear || 'N/D'}.`);
      } catch (error) {
        if (cancelled) return;
        appendLog('ERROR', error instanceof Error ? error.message : 'Error cargando rango temporal.');
      }
    };
    void loadDateRange();
    return () => {
      cancelled = true;
    };
  }, [datasetId]);

  useEffect(() => {
    if (timeMode === 'full' && dateRange) {
      setStartDate(dateRange.startDate || '');
      setEndDate(dateRange.endDate || '');
    }
  }, [dateRange, timeMode]);

  useEffect(() => {
    setCatalogFilters({});
    setCatalogOptions({});
    setCatalogOptionStatus({});
    setCatalogOptionErrors({});
    setCatalogBundleRows([]);
    setStationCodesText('');
    setStationHelperRows([]);
    setPreview(null);
    setDownloadMetrics(null);
  }, [datasetId, selectedDepartments.join('|')]);

  // Deep-links del Asistente: por evento (navegación in-app, vía
  // aplicarDeepLinkRef para no re-suscribir) y por URL al montar (refresh o
  // enlace pegado en /extractor). NO escribimos la URL de forma continua: el
  // Extractor está SIEMPRE montado y pisaría la query de la vista activa cuando
  // está oculto, así que el restore es de entrada, no un useUrlSync completo.
  useEffect(() => {
    const onNav = (event: Event) => {
      const detail = (event as CustomEvent<NavigateDetail>).detail;
      if (detail && detail.view === 'extractor') aplicarDeepLinkRef.current(detail.params || {});
    };
    window.addEventListener(NAVIGATE_EVENT, onNav);
    if (pathToView(window.location.pathname) === 'extractor') {
      const params = parseSearch(window.location.search);
      if (params.var || params.dep || params.est || params.years) aplicarDeepLinkRef.current(params);
    }
    return () => window.removeEventListener(NAVIGATE_EVENT, onNav);
  }, []);

  // Aplica estación/años pendientes de un deep-link una vez que el rango
  // temporal corresponde al dataset destino (tras el reset por cambio de
  // variable/departamento). Así la estación no la borra el efecto de reset ni
  // los años los pisa la recarga del rango.
  useEffect(() => {
    const pending = pendingRestoreRef.current;
    if (!pending || !dateRange || dateRangeForRef.current !== datasetId) return;
    pendingRestoreRef.current = null;
    aplicarEstYears(pending.est, pending.years, dateRange);
    if (acceptedTerms) setStep('execute');
  }, [dateRange, datasetId, acceptedTerms, aplicarEstYears]);

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
    if (!datasetId || !selectedDepartments.length || !meta?.catalogFilters?.length) return;
    let cancelled = false;
    let retryPending = true;
    const definitions = meta.catalogFilters;

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
  }, [datasetId, meta?.catalogFilters, selectedDepartments.join('|')]);

  useEffect(() => {
    const definitions = meta?.catalogFilters || [];
    if (!definitions.length || !catalogBundleRows.length) {
      setCatalogOptions({});
      return;
    }
    setCatalogOptions(buildOptionsFromCatalogBundle(catalogBundleRows, definitions, catalogFilters));
  }, [catalogBundleRows, catalogFilters, meta?.catalogFilters]);

  useEffect(() => {
    if (!isBusy || operationStartedAt === null) return undefined;

    const timer = window.setInterval(() => {
      setElapsedMs(Math.round(performance.now() - operationStartedAt));
    }, 250);

    return () => window.clearInterval(timer);
  }, [isBusy, operationStartedAt]);


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
          await finalizeCompletedJob(data);
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
  }, [currentJobId, finalizeCompletedJob]);

  const projectedRows = useMemo(() => {
    const baseRows = currentJob?.processedRows ?? transferProgress?.downloadedRows ?? downloadMetrics?.rowCount ?? preview?.rowCount ?? 0;
    const totalRows = currentJob?.rowCount ?? transferProgress?.totalRows ?? downloadMetrics?.rowCount ?? preview?.rowCount ?? baseRows;
    if (!currentJob || !isBusy || !['processing', 'retrying'].includes(currentJob.status)) {
      return baseRows;
    }
    const updatedAt = Date.parse(currentJob.updatedAt);
    const secondsSinceUpdate = Number.isFinite(updatedAt) ? Math.max(0, (Date.now() - updatedAt) / 1000) : 0;
    const projected = baseRows + Math.max(0, currentJob.rowsPerSecond || 0) * secondsSinceUpdate;
    return Math.min(Math.max(baseRows, projected), Math.max(totalRows, baseRows));
  }, [currentJob, downloadMetrics?.rowCount, elapsedMs, isBusy, preview?.rowCount, transferProgress]);

  useEffect(() => {
    setAnimatedRows((current) => {
      if (!Number.isFinite(projectedRows)) return current;
      if (Math.abs(projectedRows - current) < 10) return Math.round(projectedRows);
      return Math.round(current + (projectedRows - current) * 0.35);
    });
  }, [projectedRows, elapsedMs]);

  const validateCurrentConfiguration = () => {
    if (!acceptedTerms) {
      throw new Error('Debes aceptar el aviso legal antes de continuar.');
    }
    if (!datasetId) {
      throw new Error('Selecciona una variable para continuar.');
    }
    if (!selectedDepartments.length) {
      throw new Error('Selecciona al menos un departamento. Las descargas globales no estan permitidas.');
    }
    if (!startDate || !endDate) {
      throw new Error('Debes definir el rango temporal.');
    }
    if (startDate > endDate) {
      throw new Error('La fecha inicial no puede ser mayor que la fecha final.');
    }
  };

  const toggleDepartment = (department: string) => {
    setSelectedDepartments((current) =>
      current.includes(department) ? current.filter((item) => item !== department) : [...current, department]
    );
  };

  const selectAllDepartments = (departments: string[]) => setSelectedDepartments(departments);
  const clearDepartments = () => setSelectedDepartments([]);

  // Comparte la configuración actual como deep-link {var,dep,est,years}. dep/est
  // se serializan separados por coma. Limitación documentada: las fechas custom
  // se comparten por rango de años (el parser no maneja fechas exactas).
  const shareConfiguration = async () => {
    const stationCodes = parseStationCodes(stationCodesText);
    const years =
      timeMode === 'custom' && startDate && endDate ? `${startDate.slice(0, 4)}-${endDate.slice(0, 4)}` : undefined;
    const search = buildSearch({
      var: datasetId || undefined,
      dep: selectedDepartments.length ? selectedDepartments.join(',') : undefined,
      est: stationCodes.length ? stationCodes.join(',') : undefined,
      years,
    });
    const url = `${window.location.origin}/extractor${search ? `?${search}` : ''}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Configuración copiada', {
        description:
          timeMode === 'custom'
            ? 'Enlace listo. Las fechas custom se comparten por rango de años.'
            : 'Enlace listo para compartir.',
      });
      appendLog('SUCCESS', 'Enlace de configuración copiado al portapapeles.');
    } catch {
      toast.error('No se pudo copiar el enlace', { description: 'Copia la dirección manualmente.' });
    }
  };

  const toggleCatalogValue = (filterKey: string, value: string) => {
    setCatalogFilters((current) => {
      const values = current[filterKey] || [];
      const nextValues = values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
      return { ...current, [filterKey]: nextValues };
    });
  };

  const toggleOutputFormat = (format: OutputFormat) => {
    setSelectedFormats((current) =>
      current.includes(format)
        ? current.length === 1
          ? current
          : current.filter((item) => item !== format)
        : [...current, format]
    );
  };

  const validateCoverageForDownload = async () => {
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

      const discoveredDepartments = reports.flatMap((report) => report.matched.map((item) => item.departamento));
      const enhancedDepartments = Array.from(new Set([...selectedDepartments, ...discoveredDepartments].filter(Boolean)));
      const unmatchedRows = reports.reduce((sum, report) => sum + report.unmatched_rows, 0);

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
  };

  const loadStationHelper = async () => {
    setStationHelperLoading(true);
    appendLog('INFO', 'Consultando estaciones del catálogo segun los filtros actuales...');
    try {
      const data = await apiJson<{ stations?: StationHelperRow[] }>('/api/stations-helper', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          datasetId,
          departments: selectedDepartments,
          startDate,
          endDate,
          catalogFilters,
        }),
      }, 'No fue posible cargar estaciones de apoyo.');
      setStationHelperRows(data.stations || []);
      appendLog('SUCCESS', `Estaciones de apoyo cargadas: ${data.stations?.length || 0}.`);
    } catch (error) {
      appendLog('ERROR', error instanceof Error ? error.message : 'Error cargando estaciones de apoyo.');
    } finally {
      setStationHelperLoading(false);
    }
  };

  const runPreview = async () => {
    try {
      validateCurrentConfiguration();
      setIsBusy(true);
      setOperationStartedAt(performance.now());
      setElapsedMs(0);
      setAnimatedRows(0);
      setTransferProgress(null);
      setProgress(20);
      setActiveTask('Generando vista previa...');
      appendLog('INFO', 'Generando vista previa operativa...');
      const data = await apiJson<PreviewResponse>('/api/preview', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(executionPayload),
      }, 'No fue posible generar la vista previa.');
      setPreview(data);
      setProgress(100);
      setActiveTask('Vista previa completada');
      appendLog(
        'SUCCESS',
        `Vista previa completada: ${data.rowCount.toLocaleString('es-CO')} filas, ${data.summary.stationCount} estaciones, ${formatDuration(data.processingMs)}.`
      );
    } catch (error) {
      setProgress(100);
      setActiveTask('Error en vista previa');
      appendLog('ERROR', error instanceof Error ? error.message : 'Error en la vista previa.');
    } finally {
      setIsBusy(false);
    }
  };

  const runDownload = async () => {
    try {
      validateCurrentConfiguration();
      if (!selectedFormats.length) {
        throw new Error('Selecciona al menos un formato de salida.');
      }

      setIsBusy(true);
      setOperationStartedAt(performance.now());
      setElapsedMs(0);
      setAnimatedRows(0);
      setDownloadMetrics(null);
      setTransferProgress(null);
      setCurrentJob(null);
      setCurrentJobId(null);
      pollFailuresRef.current = 0;
      setProgress(2);
      setActiveTask('Estimando volumen de descarga...');

      const downloadPayload = executionPayload;
      appendLog('INFO', `Estimando volumen máximo por ${EXPORT_PLAN_FAST_TIMEOUT_MS / 1000} segundos...`);

      let exportPlan: ExportPlanResponse | null = null;
      try {
        exportPlan = await getFastExportPlan(downloadPayload);
        setTransferProgress({
          totalPages: Math.max(exportPlan.totalPages, 1),
          completedPages: 0,
          totalRows: exportPlan.rowCount,
          downloadedRows: 0,
          totalParts: 1,
          completedParts: 0,
        });
        setProgress(7);
        setActiveTask(`Volumen estimado: ${exportPlan.rowCount.toLocaleString('es-CO')} filas en ${Math.max(exportPlan.totalPages, 1)} página(s)`);
        appendLog(
          'SUCCESS',
          `Plan listo: ${exportPlan.rowCount.toLocaleString('es-CO')} filas, ${Math.max(exportPlan.totalPages, 1)} página(s), ${exportPlan.queryPlans} plan(es).`
        );
      } catch (error) {
        setProgress(6);
        setActiveTask('Plan pesado; iniciando descarga sin bloquear...');
        appendLog(
          'INFO',
          'La estimación exacta esta tardando por el volumen de Socrata. Se inicia el job y el progreso se actualizará con páginas reales procesadas.'
        );
      }
      appendLog('INFO', 'Creando job asíncrono de exportación...');

      const data = await apiJson<ExportJobStatusResponse>('/api/jobs', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ...downloadPayload,
          formats: selectedFormats,
          exportPlan: exportPlan || undefined,
        }),
      }, 'No fue posible crear el job de exportación.');

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
      setProgress(5);
      setActiveTask('Job creado, esperando procesamiento...');
      appendLog('SUCCESS', `Job ${data.jobId.slice(0, 8)} creado. El backend continuará la exportación por lotes.`);
    } catch (error) {
      setProgress(100);
      setIsBusy(false);
      if (error instanceof ApiError && error.status === 429) {
        const wait = error.retryAfterSeconds ? ` en ~${Math.ceil(error.retryAfterSeconds / 60)} minuto(s)` : ' en unos minutos';
        setActiveTask('Servidor ocupado');
        const msg = `${error.message} Intenta de nuevo${wait}.`;
        appendLog('ERROR', msg);
        toast.error('Servidor ocupado', { description: msg });
      } else if (error instanceof ApiError && error.status === 413) {
        setActiveTask('Selección demasiado grande');
        appendLog('ERROR', error.message);
        toast.error('Selección demasiado grande', { description: error.message });
      } else {
        setActiveTask('Error en descarga');
        const msg = error instanceof Error ? error.message : 'Error durante la descarga.';
        appendLog('ERROR', msg);
        toast.error('Error en la descarga', { description: msg });
      }
    }
  };

  // Requisito faltante por sección del acordeón (motivo mostrado inline en la
  // cabecera), estado de completitud y resumen para la cabecera colapsada.
  const sectionRequirement = (id: StepId): string | null => {
    if (id === 'variable') return datasetId ? null : 'Selecciona una variable.';
    if (id === 'territory') return selectedDepartments.length ? null : 'Selecciona al menos un departamento.';
    if (id === 'time') return !startDate || !endDate || startDate > endDate ? 'Configura un rango temporal válido.' : null;
    return null; // 'advanced' es opcional
  };

  const sectionComplete = (id: StepId): boolean => {
    if (id === 'advanced') {
      return Object.values(catalogFilters).some((values) => values.length) || parseStationCodes(stationCodesText).length > 0;
    }
    return sectionRequirement(id) === null;
  };

  const sectionSummary = (id: StepId): string => {
    if (id === 'variable') return selectedDataset?.name || 'Sin selección';
    if (id === 'territory') {
      return selectedDepartments.length
        ? selectedDepartments.length <= 2
          ? selectedDepartments.join(', ')
          : `${selectedDepartments.length} departamentos`
        : 'Sin selección';
    }
    if (id === 'advanced') {
      const filtros = selectionSummary.advancedSelections.reduce((sum, item) => sum + item.values.length, 0);
      const estaciones = selectionSummary.stationCodes.length;
      const partes: string[] = [];
      if (filtros) partes.push(`${filtros} filtro(s)`);
      if (estaciones) partes.push(`${estaciones} estación(es)`);
      return partes.length ? partes.join(' · ') : 'Sin filtros (opcional)';
    }
    // time
    if (timeMode === 'full') return 'Todo el histórico';
    return startDate && endDate ? `${startDate} → ${endDate}` : 'Sin rango';
  };

  // Por qué la descarga está bloqueada: consentimiento + configuración mínima.
  const downloadRequirement = !acceptedTerms
    ? 'Acepta el aviso legal para descargar.'
    : sectionRequirement('variable') || sectionRequirement('territory') || sectionRequirement('time');

  const runtimeRows = Math.max(animatedRows, transferProgress?.downloadedRows ?? downloadMetrics?.rowCount ?? preview?.rowCount ?? 0);
  const runtimeTotalRows = transferProgress?.totalRows ?? preview?.rowCount ?? downloadMetrics?.rowCount ?? 0;
  const runtimeElapsedMs = isBusy ? elapsedMs : downloadMetrics?.processingMs ?? preview?.processingMs ?? 0;
  const runtimePages = transferProgress
    ? `${transferProgress.completedPages}/${transferProgress.totalPages}`
    : downloadMetrics
      ? `${downloadMetrics.downloadedPages}/${downloadMetrics.downloadedPages}`
      : '0/0';
  // ETA en rango amable (sin falsa precisión); 'Calculando' mientras planea.
  const runtimeEta =
    etaAmable(currentJob?.estimatedRemainingSeconds) ||
    (currentJob?.status === 'planning' ? 'Calculando' : 'Sin dato');
  const runtimeRate = formatRowsPerSecond(currentJob?.rowsPerSecond || 0);
  const runtimeCurrentPage = currentJob
    ? `${currentJob.currentPage}/${Math.max(currentJob.totalPages, 1)}`
    : runtimePages;
  const readyDownloadJob = currentJob?.status === 'completed' && currentJob.parts.length ? currentJob : null;

  // Estado agregado del héroe de progreso: tipo (color/copys), fase del stepper
  // y textos centrales. La fase se deriva del status del job; "Empacar" se
  // infiere del texto de la etapa porque la API no expone un status propio para
  // ese tramo.
  const jobStatus = currentJob?.status;
  const stageText = currentJob?.currentStage || activeTask;
  const isErrorState = jobStatus === 'failed';
  const isDoneState = Boolean(readyDownloadJob);
  const isRunningState = isBusy && !isDoneState;
  const statusKind: ProgressStatusKind = isErrorState
    ? 'error'
    : isDoneState
      ? 'done'
      : isRunningState
        ? 'running'
        : 'idle';
  const phaseIndex = isDoneState
    ? 3
    : jobStatus === 'processing' || jobStatus === 'retrying'
      ? /empaqu|empac|zip|comprim|pack/i.test(stageText)
        ? 2
        : 1
      : jobStatus === 'queued' || jobStatus === 'planning'
        ? 0
        : isRunningState
          ? 0
          : -1;
  const statusPillLabel = isErrorState
    ? 'Error'
    : isDoneState
      ? 'Completado'
      : isRunningState
        ? 'En proceso'
        : progress >= 100
          ? 'Listo'
          : 'En espera';
  const heroCenterCaption = isDoneState
    ? 'ZIP listo'
    : isErrorState
      ? 'Con errores'
      : isRunningState
        ? runtimeEta === 'Sin dato' || runtimeEta === 'Calculando'
          ? 'Calculando ETA'
          : `ETA · ${runtimeEta}`
        : 'En espera';

  useEffect(() => {
    onRuntimeChange?.({
      isBusy,
      activeTask,
      progress,
      elapsedMs: runtimeElapsedMs,
      downloadedRows: runtimeRows,
      totalRows: runtimeTotalRows,
    });
  }, [activeTask, elapsedMs, isBusy, onRuntimeChange, progress, runtimeElapsedMs, runtimeRows, runtimeTotalRows]);

  // Estimación en vivo del volumen (debounce 1.5 s). Cuida el box: solo corre con
  // config válida y sin job activo, cancela en cada cambio y reusa el corte de
  // 2.5 s de getFastExportPlan (si la planeación tarda, no muestra estimación).
  useEffect(() => {
    if (!datasetId || !selectedDepartments.length || !startDate || !endDate || startDate > endDate || isBusy) {
      setLiveEstimate(null);
      setEstimating(false);
      return undefined;
    }
    let cancelled = false;
    setEstimating(true);
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const plan = await getFastExportPlan(executionPayload);
          if (!cancelled && plan && Number.isFinite(plan.rowCount)) setLiveEstimate(plan);
          else if (!cancelled) setLiveEstimate(null);
        } catch {
          if (!cancelled) setLiveEstimate(null);
        } finally {
          if (!cancelled) setEstimating(false);
        }
      })();
    }, 1500);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [executionPayload, datasetId, selectedDepartments, startDate, endDate, isBusy]);

  const estimatedBytes = liveEstimate
    ? Math.max(0, liveEstimate.rowCount) * 25 * Math.max(selectedFormats.length, 1)
    : 0;

  // Props compartidas por las secciones del acordeón y el CTA de ejecución;
  // `step` se pasa aparte en cada uso.
  const stepPanelProps = {
    meta,
    datasetId,
    selectedDataset,
    acceptedTerms,
    onAcceptedTermsChange: setAcceptedTerms,
    selectedDepartments,
    onToggleDepartment: toggleDepartment,
    onSelectAllDepartments: selectAllDepartments,
    onClearDepartments: clearDepartments,
    catalogFilters,
    catalogOptions,
    catalogOptionStatus,
    catalogOptionErrors,
    onToggleCatalogValue: toggleCatalogValue,
    onLoadCatalogOptions: loadCatalogOptions,
    canLoadCatalogOptions: Boolean(datasetId && selectedDepartments.length),
    stationCodesText,
    onStationCodesTextChange: setStationCodesText,
    onLoadStationHelper: loadStationHelper,
    stationHelperRows,
    stationHelperLoading,
    dateRange,
    timeMode,
    setTimeMode,
    startDate,
    endDate,
    onStartDateChange: setStartDate,
    onEndDateChange: setEndDate,
    selectedFormats,
    onToggleOutputFormat: toggleOutputFormat,
    onDatasetChange: setDatasetId,
    selectionSummary,
    coverageReports,
    coverageLoading,
    onRunPreview: runPreview,
    onRunDownload: runDownload,
    isBusy,
    downloadRequirement,
  };

  // Cancelar la espera del cliente: detiene el polling y resetea la UI. NO mata el
  // job en el servidor (no hay endpoint de cancelación); si termina, el ZIP queda
  // disponible 1 h en el centro de descargas. setCurrentJobId(null) además limpia
  // ACTIVE_JOB_KEY (efecto), así que una recarga no vuelve a engancharse.
  const cancelarEspera = () => {
    setCurrentJobId(null);
    setCurrentJob(null);
    setTransferProgress(null);
    setIsBusy(false);
    setProgress(0);
    setActiveTask('Esperando configuración');
    appendLog('INFO', 'Espera cancelada. El job puede seguir en el servidor; si termina, el ZIP queda disponible 1 hora.');
  };

  // Resumen-primero en prosa (antes del botón): qué se va a descargar, en lenguaje
  // natural, para prevenir descargas erróneas y fijar expectativa.
  const resumenAnios =
    timeMode === 'custom'
      ? { inicio: startDate ? Number(startDate.slice(0, 4)) : null, fin: endDate ? Number(endDate.slice(0, 4)) : null }
      : {
          inicio: dateRange?.startDate ? Number(dateRange.startDate.slice(0, 4)) : null,
          fin: dateRange?.endDate ? Number(dateRange.endDate.slice(0, 4)) : null,
        };
  const resumenProsa = construirResumenProsa({
    variable: selectedDataset?.name ?? '',
    departamentos: selectedDepartments,
    anioInicio: resumenAnios.inicio,
    anioFin: resumenAnios.fin,
    estaciones: liveEstimate?.stationPoolSize ?? 0,
  });

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-12 min-h-[calc(100vh-7rem)]">
      <div className="space-y-6 xl:col-span-4 xl:sticky xl:top-6 self-start">
        {/* Configuración: acordeón todo-en-uno (Fase 2) */}
        <div className="animate-fade-in-up rounded-2xl border border-border bg-card p-4 shadow-glow">
          <div className="mb-3 flex items-center justify-between gap-3 px-2 pt-1">
            <h2 className="text-lg font-bold text-card-foreground">Configurar descarga</h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={shareConfiguration}
                disabled={!datasetId}
                title="Copiar enlace con esta configuración"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:border-accent/40 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
              >
                <Link2 className="h-3.5 w-3.5" />
                Compartir
              </button>
            </div>
          </div>
          <div className="space-y-2">
            {accordionSections.map((section) => {
              const Icon = section.icon;
              const isOpen = openSection === section.id;
              const complete = sectionComplete(section.id);
              const requirement = sectionRequirement(section.id);
              const panelId = `acordeon-${section.id}`;
              return (
                <div key={section.id} className="overflow-hidden rounded-xl border border-border bg-background">
                  <button
                    type="button"
                    onClick={() => setOpenSection((current) => (current === section.id ? null : section.id))}
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-colors ${
                        complete ? 'border-success/40 bg-success/10 text-success' : 'border-accent/30 bg-accent/10 text-accent'
                      }`}
                    >
                      {complete ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold text-card-foreground">{section.title}</span>
                      <span className={`block truncate text-xs ${requirement && !isOpen ? 'text-warning' : 'text-muted-foreground'}`}>
                        {requirement && !isOpen ? requirement : sectionSummary(section.id)}
                      </span>
                    </span>
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                    />
                  </button>
                  {isOpen && (
                    <div id={panelId} className="border-t border-border px-4 py-4">
                      <StepPanel step={section.id} {...stepPanelProps} />
                      {requirement && (
                        <p role="status" className="mt-4 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                          <Info className="h-3.5 w-3.5 shrink-0 text-accent" />
                          {requirement}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Consentimiento (barra no-bloqueante) + ejecución (CTA persistente) */}
        <div className="animate-fade-in-up space-y-5 rounded-2xl border border-border bg-card p-6 shadow-glow">
          <SlideToAccept accepted={acceptedTerms} onChange={setAcceptedTerms} />
          {(estimating || liveEstimate) && (
            <div className="rounded-xl border border-border bg-background p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Estimación antes de descargar</p>
              {liveEstimate ? (
                <>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-center">
                    <div>
                      <p className="font-mono text-lg font-bold tabular-nums text-card-foreground">
                        {liveEstimate.rowCount.toLocaleString('es-CO')}
                      </p>
                      <p className="text-[11px] text-muted-foreground">filas aprox.</p>
                    </div>
                    <div>
                      <p className="font-mono text-lg font-bold tabular-nums text-card-foreground">~{formatBytes(estimatedBytes)}</p>
                      <p className="text-[11px] text-muted-foreground">peso aprox.</p>
                    </div>
                  </div>
                  <p className="mt-2 text-[11px] text-muted-foreground">Estimación rápida; el volumen real puede variar.</p>
                </>
              ) : (
                <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                  <LoaderCircle className="h-4 w-4 animate-spin text-accent" />
                  Calculando volumen…
                </p>
              )}
            </div>
          )}
          {selectedDataset && (
            <p className="rounded-xl border border-accent/20 bg-accent/5 px-4 py-3 text-sm leading-relaxed text-card-foreground">
              {resumenProsa}
            </p>
          )}
          <StepPanel step="execute" {...stepPanelProps} />
        </div>
      </div>

      <div className="xl:col-span-8 space-y-6">
        <ProgressHero
          progress={progress}
          statusKind={statusKind}
          statusPillLabel={statusPillLabel}
          centerCaption={heroCenterCaption}
          phaseIndex={phaseIndex}
          rows={runtimeRows}
          totalRows={runtimeTotalRows}
          rate={runtimeRate}
          page={runtimeCurrentPage}
          elapsedLabel={formatDuration(runtimeElapsedMs)}
          task={stageText}
        />

        {isBusy && !readyDownloadJob && (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={cancelarEspera}
              className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-destructive/50 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive"
            >
              Cancelar
            </button>
          </div>
        )}

        <CuriosidadEspera
          activo={isBusy}
          esPrecipitacion={(selectedDataset?.name ?? '').toLowerCase().includes('precipit')}
          departamentos={selectedDepartments}
        />

        {readyDownloadJob && (
          <ReadyDownloadPanel job={readyDownloadJob} onDownloadPart={downloadJobPart} />
        )}

        <div className="animate-fade-in-up bg-card border border-border rounded-2xl overflow-hidden shadow-glow">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <h3 className="text-card-foreground font-bold">Vista previa de resultados</h3>
            <span className="text-muted-foreground text-sm font-mono">
              {preview?.rows?.length
                ? `muestra de ${preview.rows.length} de ${(preview.rowCount || 0).toLocaleString('es-CO')} filas`
                : `${preview?.rowCount?.toLocaleString('es-CO') || 0} filas encontradas`}
            </span>
          </div>
          <div className="p-6">
            {!preview?.rows?.length ? (
              <EmptyState
                icon={Search}
                title="Sin vista previa"
                description="Genera una vista previa para inspeccionar las primeras filas antes de descargar."
                hint="Genera una vista previa"
              />
            ) : (
              <>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  <MetricCard title="Muestra" value={String(preview.rows.length)} icon={Search} />
                  <MetricCard title="Estaciones" value={String(preview.summary.stationCount)} icon={MapPin} />
                  <MetricCard title="Municipios" value={String(preview.summary.municipalityCount)} icon={Layers} />
                  <MetricCard title="Tiempo" value={formatDuration(preview.processingMs)} icon={TimerReset} />
                </div>
                <div
                  role="region"
                  aria-label="Vista previa de datos (desplázate para ver más)"
                  tabIndex={0}
                  className="max-h-[28rem] overflow-auto rounded-lg border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 z-10 text-muted-foreground">
                      <tr>
                        {previewColumns.map((column) => (
                          <th key={column} className="bg-card p-3 text-left font-mono font-bold shadow-[inset_0_-1px_0_var(--border)]">
                            {column}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="text-card-foreground font-mono">
                      {preview.rows.map((row, rowIndex) => (
                        <tr key={rowIndex} className="border-b border-border hover:bg-muted/50 transition-colors">
                          {previewColumns.map((column) => (
                            <td key={`${rowIndex}-${column}`} className="p-3">
                              {String(row[column] ?? '')}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Detalle técnico: info de baja utilidad para el usuario final, colapsada (menos es más). */}
        <details className="group animate-fade-in-up">
          <summary className="flex cursor-pointer list-none items-center justify-between rounded-2xl border border-border bg-card px-6 py-4 font-bold text-card-foreground shadow-glow transition-colors hover:border-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent [&::-webkit-details-marker]:hidden">
            <span className="flex items-center gap-2"><Layers className="h-4 w-4 text-muted-foreground" />Ver detalle técnico</span>
            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
          </summary>
          <div className="mt-4 space-y-6">
            <div className="bg-card border border-border rounded-2xl p-6 shadow-glow">
              <h3 className="text-card-foreground font-bold mb-4">Salida esperada</h3>
              <div className="space-y-3 text-sm">
                <SummaryRow label="Entrega" value="ZIP único organizado por carpetas" />
                <SummaryRow label="Formatos" value={selectionSummary.formats.length ? selectionSummary.formats.join(', ').toUpperCase() : 'Sin selección'} />
                <SummaryRow label="Pool de estaciones" value={String(downloadMetrics?.stationPoolSize || preview?.stationPoolSize || 0)} />
                <SummaryRow label="Planes de consulta" value={String(downloadMetrics?.queryPlans || preview?.queryPlans || 0)} />
                <SummaryRow label="ZIP esperado" value={readyDownloadJob || downloadMetrics ? '1 archivo' : 'Pendiente'} />
                <SummaryRow label="Municipios cubiertos" value={String(downloadMetrics?.municipalityCount || preview?.summary.municipalityCount || 0)} />
              </div>
            </div>

            <OperationTimeline logs={logs} />

            <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-glow">
              <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                <h3 className="text-card-foreground font-bold">Métricas de descarga</h3>
                <span className="text-muted-foreground text-sm font-mono">{downloadMetrics?.fileName || 'Sin ejecución final'}</span>
              </div>
              <div className="p-6">
                {!downloadMetrics ? (
                  <EmptyState
                    icon={Layers}
                    title="Sin métricas todavía"
                    description="Al completar una descarga verás filas, estaciones, municipios, peso y tiempo."
                    hint=""
                  />
                ) : (
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <MetricCard title="Filas" value={downloadMetrics.rowCount.toLocaleString('es-CO')} icon={Database} />
                    <MetricCard title="Tiempo total" value={formatDuration(downloadMetrics.processingMs)} icon={Clock3} />
                    <MetricCard title="Peso ZIP" value={formatBytes(downloadMetrics.sizeBytes)} icon={FileArchive} />
                    <MetricCard title="Estaciones" value={String(downloadMetrics.stationCount)} icon={MapPin} />
                    <MetricCard title="Municipios" value={String(downloadMetrics.municipalityCount)} icon={Layers} />
                    <MetricCard title="Zonas" value={String(downloadMetrics.zoneCount)} icon={Filter} />
                    <MetricCard title="Inicio observado" value={formatDateLabel(downloadMetrics.observedStart)} icon={Calendar} />
                    <MetricCard title="Fin observado" value={formatDateLabel(downloadMetrics.observedEnd)} icon={Calendar} />
                  </div>
                )}
              </div>
            </div>
          </div>
        </details>

        <DownloadCenter
          tick={historyTick}
          onRedownload={(entry) => {
            if (entry.downloadPath) void triggerBrowserDownload(apiUrl(entry.downloadPath), entry.fileName);
          }}
        />
      </div>
    </div>
  );
}

function StepPanel({
  step,
  meta,
  datasetId,
  selectedDataset,
  acceptedTerms,
  onAcceptedTermsChange,
  selectedDepartments,
  onToggleDepartment,
  onSelectAllDepartments,
  onClearDepartments,
  catalogFilters,
  catalogOptions,
  catalogOptionStatus,
  catalogOptionErrors,
  onToggleCatalogValue,
  onLoadCatalogOptions,
  canLoadCatalogOptions,
  stationCodesText,
  onStationCodesTextChange,
  onLoadStationHelper,
  stationHelperRows,
  stationHelperLoading,
  dateRange,
  timeMode,
  setTimeMode,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  selectedFormats,
  onToggleOutputFormat,
  onDatasetChange,
  selectionSummary,
  coverageReports,
  coverageLoading,
  onRunPreview,
  onRunDownload,
  isBusy,
  downloadRequirement,
}: {
  step: StepId;
  meta: MetaResponse | null;
  datasetId: string;
  selectedDataset: DatasetMeta | null;
  acceptedTerms: boolean;
  onAcceptedTermsChange: (value: boolean) => void;
  selectedDepartments: string[];
  onToggleDepartment: (department: string) => void;
  onSelectAllDepartments: (departments: string[]) => void;
  onClearDepartments: () => void;
  catalogFilters: Record<string, string[]>;
  catalogOptions: Record<string, OptionItem[]>;
  catalogOptionStatus: Record<string, CatalogOptionStatus>;
  catalogOptionErrors: Record<string, string>;
  onToggleCatalogValue: (filterKey: string, value: string) => void;
  onLoadCatalogOptions: (definition: CatalogFilterDefinition, force?: boolean, cacheOnly?: boolean) => void;
  canLoadCatalogOptions: boolean;
  stationCodesText: string;
  onStationCodesTextChange: (value: string) => void;
  onLoadStationHelper: () => void;
  stationHelperRows: StationHelperRow[];
  stationHelperLoading: boolean;
  dateRange: DateRangeResponse | null;
  timeMode: TimeMode;
  setTimeMode: (value: TimeMode) => void;
  startDate: string;
  endDate: string;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  selectedFormats: OutputFormat[];
  onToggleOutputFormat: (format: OutputFormat) => void;
  onDatasetChange: (value: string) => void;
  selectionSummary: {
    departments: string;
    advancedSelections: Array<{ label: string; values: string[] }>;
    stationCodes: string[];
    formats: OutputFormat[];
  };
  coverageReports: CoverageReport[];
  coverageLoading: boolean;
  onRunPreview: () => void;
  onRunDownload: () => void;
  isBusy: boolean;
  downloadRequirement: string | null;
}) {
  const [filterSearch, setFilterSearch] = useState<Record<string, string>>({});
  const [departmentSearch, setDepartmentSearch] = useState('');
  const [showMap, setShowMap] = useState(false);

  // Alta/baja de un código de estación desde la tabla de apoyo (clic = agrega o
  // quita). Reescribe el textarea normalizado a lista separada por comas.
  const selectedStationCodes = parseStationCodes(stationCodesText);
  const toggleStationCode = (code: string) => {
    const next = selectedStationCodes.includes(code)
      ? selectedStationCodes.filter((item) => item !== code)
      : [...selectedStationCodes, code];
    onStationCodesTextChange(next.join(', '));
  };

  if (step === 'variable') {
    return (
      <Section title="Variable de trabajo" icon={Database}>
        <SelectInput label="Variable hídrica o meteorológica" value={datasetId} onChange={onDatasetChange}>
          {(meta?.datasets || []).map((dataset) => (
            <option key={dataset.id} value={dataset.id}>
              {dataset.name} · {dataset.category}
            </option>
          ))}
        </SelectInput>
        <div className="rounded-lg border border-border bg-background p-4 text-sm text-muted-foreground">
          <p className="font-semibold text-card-foreground mb-1">{selectedDataset?.name || 'Sin selección'}</p>
          <p>Dataset: {selectedDataset?.id || 'N/D'}</p>
          <p>Categoría: {selectedDataset?.category || 'N/D'}</p>
          <p>Columna temporal: {selectedDataset?.dateColumn || 'N/D'}</p>
        </div>
      </Section>
    );
  }

  if (step === 'territory') {
    return (
      <Section title="Cobertura territorial" icon={MapPin}>
        <div className="rounded-lg border border-warning/30 bg-warning/10 p-4 text-sm text-warning">
          Selecciona al menos un departamento. Las descargas globales estan bloqueadas para mantener el servicio en costo $0.00 y evitar procesos masivos accidentales.
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={departmentSearch}
              onChange={(event) => setDepartmentSearch(event.target.value)}
              placeholder="Buscar departamento"
              className="w-full rounded-lg border border-border bg-input py-2 pl-9 pr-3 text-sm text-card-foreground focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onSelectAllDepartments(meta?.departments || [])}
              className="rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold text-card-foreground transition-[border-color,transform] duration-200 hover:border-accent/40 active:scale-[0.97]"
            >
              Todos
            </button>
            <button
              type="button"
              onClick={onClearDepartments}
              disabled={!selectedDepartments.length}
              className="rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold text-muted-foreground transition-[border-color,transform] duration-200 hover:border-accent/40 active:scale-[0.97] disabled:opacity-50"
            >
              Ninguno
            </button>
            <button
              type="button"
              onClick={() => setShowMap((open) => !open)}
              aria-pressed={showMap}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-[border-color,transform] duration-200 active:scale-[0.97] ${
                showMap ? 'border-accent bg-accent/15 text-accent' : 'border-border bg-background text-muted-foreground hover:border-accent/40'
              }`}
            >
              <MapPin className="h-3.5 w-3.5" />
              Mapa
            </button>
          </div>
        </div>

        {showMap && (
          <Suspense
            fallback={
              <div className="flex h-[320px] items-center justify-center rounded-lg border border-border text-xs text-muted-foreground">
                Cargando mapa…
              </div>
            }
          >
            <MapaSelectorDepartamentos
              departments={meta?.departments || []}
              selected={selectedDepartments}
              onToggle={onToggleDepartment}
            />
          </Suspense>
        )}
        <div className="flex max-h-56 flex-wrap gap-2 overflow-y-auto">
          {(meta?.departments || [])
            .filter((department) => normalizeText(department).includes(normalizeText(departmentSearch)))
            .map((department) => (
              <button
                key={department}
                type="button"
                onClick={() => onToggleDepartment(department)}
                aria-pressed={selectedDepartments.includes(department)}
                className={`rounded-full border px-3 py-2 text-xs font-semibold transition-[border-color,background-color,color,transform] duration-200 active:scale-[0.96] ${
                  selectedDepartments.includes(department)
                    ? 'border-accent bg-accent/15 text-accent'
                    : 'border-border bg-background text-muted-foreground hover:border-accent/40'
                }`}
              >
                {department}
              </button>
            ))}
        </div>
        <div className="rounded-lg border border-border bg-background p-3 text-sm text-muted-foreground">
          Selección actual:{' '}
          {selectedDepartments.length
            ? `${selectedDepartments.length} · ${selectedDepartments.join(', ')}`
            : 'Sin departamentos seleccionados'}
        </div>
      </Section>
    );
  }

  if (step === 'advanced') {
    return (
      <Section title="Personalización avanzada" icon={Filter}>
        <div className="rounded-lg border border-border bg-background p-4 text-sm text-muted-foreground">
          Estos catálogos se precargan por dataset y departamento para que la selección sea más rápida. La descarga
          final sigue aplicando fechas, municipios, estaciones y demás filtros exactamente como los selecciones.
        </div>
        {(meta?.catalogFilters || []).map((definition) => {
          const status = catalogOptionStatus[definition.key] || 'idle';
          const selectedCount = (catalogFilters[definition.key] || []).length;
          const search = normalizeText(filterSearch[definition.key] || '');
          const options = (catalogOptions[definition.key] || []).filter((option) =>
            normalizeText(`${option.label || option.value} ${option.total}`).includes(search)
          );

          return (
            <div key={definition.key} className="space-y-2">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <label className="text-sm font-semibold text-card-foreground">{definition.label}</label>
                <span className="rounded-full border border-border bg-card px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                  {selectedCount} seleccionados
                </span>
              </div>
              <input
                value={filterSearch[definition.key] || ''}
                onChange={(event) => setFilterSearch((current) => ({ ...current, [definition.key]: event.target.value }))}
                placeholder={`Buscar ${definition.label.toLowerCase()}`}
                disabled={status !== 'ready'}
                className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-card-foreground focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60"
              />
              <div className="max-h-48 overflow-y-auto rounded-lg border border-border bg-background p-3">
                {status === 'idle' ? (
                  <p className="text-sm text-muted-foreground">
                    {canLoadCatalogOptions ? 'Catálogo preparado automáticamente.' : 'Completa variable y departamento.'}
                  </p>
                ) : status === 'loading' && !options.length ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <LoaderCircle className="h-4 w-4 animate-spin text-accent" />
                    Sincronizando catálogo local...
                  </div>
                ) : status === 'warming' ? (
                  <p className="text-sm text-muted-foreground">Catálogo preparado automáticamente.</p>
                ) : status === 'error' ? (
                  <p className="text-sm text-destructive">
                    {catalogOptionErrors[definition.key] || 'No fue posible sincronizar este catálogo.'}
                  </p>
                ) : !options.length ? (
                  <p className="text-sm text-muted-foreground">Sin opciones para los filtros actuales.</p>
                ) : (
                  <div className="space-y-2">
                    {status === 'loading' && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <LoaderCircle className="h-3.5 w-3.5 animate-spin text-accent" />
                        Actualizando opciones...
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {options.slice(0, 80).map((option) => {
                        const selected = (catalogFilters[definition.key] || []).includes(option.value);
                        return (
                          <button
                            key={`${definition.key}-${option.value}`}
                            type="button"
                            onClick={() => onToggleCatalogValue(definition.key, option.value)}
                            aria-pressed={selected}
                            className={`rounded-full border px-3 py-2 text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                              selected
                                ? 'border-accent bg-accent/15 text-accent'
                                : 'border-border bg-card text-muted-foreground hover:border-accent/40'
                            }`}
                          >
                            {option.label || option.value} ({option.total})
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-card-foreground">Códigos de estación manuales</label>
          <textarea
            value={stationCodesText}
            onChange={(event) => onStationCodesTextChange(event.target.value)}
            rows={4}
            placeholder="Ej: 21205790, 29045180"
            className="w-full rounded-lg border border-border bg-input px-4 py-3 text-card-foreground focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
          <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
            <span className="text-xs text-muted-foreground">
              Estaciones cargadas manualmente: {selectionSummary.stationCodes.length}
            </span>
            <button
              type="button"
              onClick={onLoadStationHelper}
              disabled={stationHelperLoading}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-semibold text-card-foreground transition-[border-color,transform] duration-200 hover:border-accent/40 active:scale-[0.98] disabled:opacity-50"
            >
              <Search className="h-4 w-4" />
              {stationHelperLoading ? 'Consultando...' : 'Ver estaciones filtradas'}
            </button>
          </div>
          {stationHelperRows.length > 0 && (
            <>
              <p className="text-xs text-muted-foreground">Toca una estación para agregarla o quitarla de la selección.</p>
              <div className="max-h-52 overflow-y-auto rounded-lg border border-border bg-background">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 border-b border-border bg-background text-muted-foreground">
                    <tr>
                      <th className="p-2 text-left">Código</th>
                      <th className="p-2 text-left">Nombre</th>
                      <th className="p-2 text-left">Municipio</th>
                      <th className="p-2 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stationHelperRows.map((item) => {
                      const added = selectedStationCodes.includes(item.code);
                      return (
                        <tr
                          key={`${item.code}-${item.name}`}
                          role="button"
                          tabIndex={0}
                          aria-pressed={added}
                          onClick={() => toggleStationCode(item.code)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              toggleStationCode(item.code);
                            }
                          }}
                          className={`cursor-pointer border-b border-border transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                            added ? 'bg-accent/10' : ''
                          }`}
                        >
                          <td className="p-2 font-mono text-card-foreground">{item.code}</td>
                          <td className="p-2 text-card-foreground">{item.name}</td>
                          <td className="p-2 text-muted-foreground">{item.municipality}</td>
                          <td className="p-2 text-right">
                            {added ? (
                              <span className="inline-flex items-center gap-1 font-semibold text-success">
                                <CheckCircle2 className="h-3.5 w-3.5" /> Añadida
                              </span>
                            ) : (
                              <span className="text-accent">+ Agregar</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </Section>
    );
  }

  if (step === 'time') {
    return (
      <Section title="Marco temporal" icon={Calendar}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ChoiceCard active={timeMode === 'full'} onClick={() => setTimeMode('full')} title="Todo el histórico" description="Usar todo el rango disponible" />
          <ChoiceCard active={timeMode === 'custom'} onClick={() => setTimeMode('custom')} title="Rango personalizado" description="Definir fechas exactas" />
        </div>
        <div className="rounded-lg border border-border bg-background p-4 text-sm text-muted-foreground">
          Rango detectado: {dateRange?.startDate || 'N/D'} {'->'} {dateRange?.endDate || 'N/D'} ({dateRange?.startYear || 'N/D'} -{' '}
          {dateRange?.endYear || 'N/D'})
        </div>
        {timeMode === 'custom' ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <InputField label="Fecha inicio" type="date" value={startDate} onChange={onStartDateChange} min={dateRange?.startDate ?? undefined} max={dateRange?.endDate ?? undefined} />
            <InputField label="Fecha fin" type="date" value={endDate} onChange={onEndDateChange} min={dateRange?.startDate ?? undefined} max={dateRange?.endDate ?? undefined} />
          </div>
        ) : (
          <div className="rounded-lg border border-success/30 bg-success/10 p-4 text-sm text-success">
            Se usará automáticamente el rango completo disponible para la variable seleccionada.
          </div>
        )}
      </Section>
    );
  }

  return (
    <Section title="Ejecución y descarga" icon={Rocket}>
      <div className="space-y-3">
        <p className="text-sm font-semibold text-card-foreground">Formatos dentro del ZIP</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {(['csv', 'json', 'parquet'] as OutputFormat[]).map((format) => (
            <button
              key={format}
              type="button"
              onClick={() => onToggleOutputFormat(format)}
              className={`rounded-lg border px-4 py-3 text-sm font-semibold transition-all ${
                selectedFormats.includes(format)
                  ? 'border-accent bg-accent/15 text-accent'
                  : 'border-border bg-background text-muted-foreground hover:border-accent/40'
              }`}
            >
              {format.toUpperCase()}
            </button>
          ))}
        </div>
        <div className="rounded-lg border border-border bg-background p-3 text-xs text-muted-foreground">
          La descarga final se entrega como paquete ZIP comprimido.
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <button
          type="button"
          onClick={onRunPreview}
          disabled={isBusy || Boolean(downloadRequirement)}
          title={downloadRequirement ?? undefined}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-3 text-sm font-semibold text-card-foreground transition-[border-color,transform] duration-200 hover:border-accent/40 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <FileSearch className="h-4 w-4" />
          Vista previa
        </button>
        <button
          type="button"
          onClick={onRunDownload}
          disabled={isBusy || coverageLoading || Boolean(downloadRequirement)}
          title={downloadRequirement ?? undefined}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-primary to-accent px-4 py-3 text-sm font-semibold text-primary-foreground transition-[box-shadow,transform] duration-200 hover:shadow-[0_0_24px] hover:shadow-accent/40 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {coverageLoading ? <ShieldCheck className="h-4 w-4" /> : <Download className="h-4 w-4" />}
          {coverageLoading ? 'Validando cobertura...' : 'Descargar ZIP'}
        </button>
      </div>

      {downloadRequirement && (
        <p role="status" className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Info className="h-3.5 w-3.5 shrink-0 text-accent" />
          {downloadRequirement}
        </p>
      )}

      {coverageReports.length > 0 && (
        <div className="space-y-3 rounded-lg border border-border bg-background p-4">
          {coverageReports.map((report) => (
            <div key={report.department} className="rounded-lg border border-border p-3">
              <p className="font-semibold text-card-foreground">{report.department}</p>
              <p className="text-sm text-muted-foreground">
                Variantes confirmadas: {report.matched_rows.toLocaleString('es-CO')} · Variantes no cubiertas:{' '}
                {report.unmatched_rows.toLocaleString('es-CO')}
              </p>
              {report.unmatched_discovered.length > 0 && (
                <p className="text-xs text-warning mt-1">
                  Variantes nuevas: {report.unmatched_discovered.map((item) => item.departamento).join(', ')}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

// Centro de descargas inline (Fase 2): historial local compacto con re-descarga
// dentro de la ventana de 1 h. Se refresca con `tick` al completar una descarga.
function DownloadCenter({ tick, onRedownload }: { tick: number; onRedownload: (entry: HistoryEntry) => void }) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  useEffect(() => {
    setHistory(readHistory());
  }, [tick]);

  return (
    <div className="animate-fade-in-up overflow-hidden rounded-2xl border border-border bg-card shadow-glow">
      <div className="flex items-center justify-between gap-3 border-b border-border px-6 py-4">
        <h3 className="font-bold text-card-foreground">Centro de descargas</h3>
        {history.length > 0 && (
          <span className="text-xs tabular-nums text-muted-foreground">{history.length} en este navegador</span>
        )}
      </div>
      <div className="p-6">
        {history.length === 0 ? (
          <EmptyState
            icon={Download}
            title="Sin descargas previas"
            description="Tus descargas recientes aparecerán aquí para volver a guardarlas dentro de su ventana de 1 hora."
            hint=""
          />
        ) : (
          <ul className="space-y-2">
            {history.slice(0, 5).map((item, index) => {
              const available = canDownloadAgain(item);
              return (
                <li
                  key={`${item.jobId || item.fileName}-${index}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-card-foreground">{item.variable}</p>
                    <p className="truncate text-xs tabular-nums text-muted-foreground">
                      {Number(item.rowCount || 0).toLocaleString('es-CO')} filas · {formatBytes(item.sizeBytes || 0)} · {item.timestamp}
                    </p>
                  </div>
                  {available ? (
                    <button
                      type="button"
                      onClick={() => onRedownload(item)}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-xs font-semibold text-accent transition-colors hover:bg-accent/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Descargar
                    </button>
                  ) : (
                    <span className="shrink-0 text-xs text-muted-foreground">Expirado</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

// Consentimiento no-bloqueante (Fase 2): el usuario puede configurar todo sin
// aceptar; solo la vista previa y la descarga quedan gated por esta casilla.
function Section({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <h3 className="text-card-foreground text-sm font-bold flex items-center gap-2 border-b border-border pb-2">
        <Icon className="w-4 h-4 text-accent" />
        {title}
      </h3>
      {children}
    </div>
  );
}

function ChoiceCard({
  active,
  onClick,
  title,
  description,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border p-4 text-left transition-[border-color,background-color,box-shadow,transform] duration-200 active:scale-[0.98] ${
        active
          ? 'border-accent bg-accent/10 text-card-foreground shadow-[0_0_24px_rgba(201,162,39,0.12)]'
          : 'border-border bg-background text-muted-foreground hover:border-accent/40 hover:bg-muted/40'
      }`}
    >
      <p className="font-bold text-sm">{title}</p>
      <p className="mt-1 text-xs leading-5">{description}</p>
    </button>
  );
}

function InputField({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  min,
  max,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  min?: string;
  max?: string;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="text-muted-foreground text-sm mb-2 flex items-center gap-2 font-semibold">{label}</label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        min={min}
        max={max}
        className="w-full bg-input text-card-foreground px-4 py-2 rounded-lg border border-border focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-all"
      />
    </div>
  );
}

function SelectInput({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="text-muted-foreground text-sm mb-2 flex items-center gap-2 font-semibold">{label}</label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full bg-input text-card-foreground px-4 py-2 rounded-lg border border-border focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-all"
      >
        {children}
      </select>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 border-b border-border/60 pb-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold text-card-foreground sm:text-right">{value}</span>
    </div>
  );
}

function MetricCard({ title, value, icon: Icon }: { title: string; value: string; icon: React.ElementType }) {
  return (
    <div className="group min-h-[96px] rounded-2xl border border-border bg-background p-4 shadow-glow transition-[transform,border-color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] hover:-translate-y-0.5 hover:border-accent/50">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</span>
        <Icon className="anim-bounce h-4 w-4 shrink-0 text-accent" />
      </div>
      <p className="text-sm font-bold leading-6 text-card-foreground break-words tabular-nums">{value}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panel de proceso (rediseño Fase 1): anillo + stepper de fases + chips, un
// único indicador de progreso. Todos los datos llegan ya calculados del padre.
// ---------------------------------------------------------------------------

const HERO_PILL_TONE: Record<ProgressStatusKind, string> = {
  idle: 'border-border bg-muted/40 text-muted-foreground',
  running: 'border-accent/30 bg-accent/10 text-accent',
  done: 'border-success/30 bg-success/10 text-success',
  error: 'border-destructive/30 bg-destructive/10 text-destructive',
};

function ProgressRing({ value, kind }: { value: number; kind: ProgressStatusKind }) {
  const clamped = Math.max(0, Math.min(100, value));
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);
  const stroke = kind === 'done' ? 'var(--success)' : kind === 'error' ? 'var(--destructive)' : 'url(#heroGrad)';
  return (
    <svg viewBox="0 0 120 120" className="h-full w-full" aria-hidden="true">
      <defs>
        <linearGradient id="heroGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--primary)" />
          <stop offset="100%" stopColor="var(--accent)" />
        </linearGradient>
      </defs>
      <circle cx="60" cy="60" r={radius} fill="none" stroke="var(--muted)" strokeWidth="9" />
      <circle
        cx="60"
        cy="60"
        r={radius}
        fill="none"
        stroke={stroke}
        strokeWidth="9"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform="rotate(-90 60 60)"
        className="transition-[stroke-dashoffset] duration-700 ease-out"
        style={kind === 'idle' ? { opacity: 0.5 } : undefined}
      />
    </svg>
  );
}

function HeroChip({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-border bg-background px-3 py-2">
      <Icon className="h-4 w-4 shrink-0 text-accent" />
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="font-mono text-sm font-bold leading-tight tabular-nums text-card-foreground">{value}</p>
      </div>
    </div>
  );
}

const EXPORT_PHASES: Array<{ label: string; icon: React.ElementType }> = [
  { label: 'Planear', icon: FileSearch },
  { label: 'Descargar', icon: Download },
  { label: 'Empacar', icon: FileArchive },
  { label: 'Listo', icon: CheckCircle2 },
];

function PhaseStepper({ phaseIndex, error }: { phaseIndex: number; error: boolean }) {
  const lastIndex = EXPORT_PHASES.length - 1;
  return (
    <ol className="flex w-full items-start" aria-label="Fases de la exportación">
      {EXPORT_PHASES.map((phase, index) => {
        const done = phaseIndex > index;
        const active = phaseIndex === index;
        const isErrorHere = error && active;
        const Icon = isErrorHere ? AlertTriangle : done ? CheckCircle2 : phase.icon;
        const circleTone = isErrorHere
          ? 'border-destructive bg-destructive/10 text-destructive'
          : done
            ? 'border-success bg-success/10 text-success'
            : active
              ? 'border-accent bg-accent/10 text-accent'
              : 'border-border bg-background text-muted-foreground';
        const connectorTone = phaseIndex > index ? 'bg-success' : 'bg-border';
        return (
          <li key={phase.label} className={`flex items-start ${index < lastIndex ? 'flex-1' : ''}`}>
            <div className="flex w-9 flex-col items-center gap-1.5">
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-full border transition-colors ${circleTone} ${active && !isErrorHere ? 'glow-cyan' : ''}`}
                aria-current={active ? 'step' : undefined}
              >
                <Icon className="h-4 w-4" />
              </span>
              <span
                className={`whitespace-nowrap text-[11px] font-semibold ${active || done ? 'text-card-foreground' : 'text-muted-foreground'}`}
              >
                {phase.label}
              </span>
            </div>
            {index < lastIndex && (
              <span className={`mt-[18px] h-0.5 flex-1 rounded-full transition-colors ${connectorTone}`} aria-hidden="true" />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function ProgressHero({
  progress,
  statusKind,
  statusPillLabel,
  centerCaption,
  phaseIndex,
  rows,
  totalRows,
  rate,
  page,
  elapsedLabel,
  task,
}: {
  progress: number;
  statusKind: ProgressStatusKind;
  statusPillLabel: string;
  centerCaption: string;
  phaseIndex: number;
  rows: number;
  totalRows: number;
  rate: string;
  page: string;
  elapsedLabel: string;
  task: string;
}) {
  const PillIcon =
    statusKind === 'running' ? LoaderCircle : statusKind === 'done' ? CheckCircle2 : statusKind === 'error' ? AlertTriangle : Clock3;
  return (
    <div className="bento-enter rounded-2xl border border-border bg-card p-6 shadow-glow">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h3 className="font-bold text-card-foreground">Estado de ejecución</h3>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${HERO_PILL_TONE[statusKind]}`}
        >
          <PillIcon className={`h-3.5 w-3.5 ${statusKind === 'running' ? 'animate-spin' : ''}`} />
          {statusPillLabel}
        </span>
      </div>

      <div className="flex flex-col items-center gap-6 sm:flex-row">
        <div
          className="relative h-36 w-36 shrink-0"
          role="progressbar"
          aria-label="Progreso de la operación"
          aria-valuenow={Math.round(Math.max(0, Math.min(100, progress)))}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <ProgressRing value={progress} kind={statusKind} />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-mono text-3xl font-bold tabular-nums text-card-foreground">{progressLabel(progress)}</span>
            <span className="mt-0.5 max-w-[7rem] text-center text-[11px] font-medium text-muted-foreground">{centerCaption}</span>
          </div>
        </div>

        <div className="w-full flex-1 space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Filas procesadas</p>
            <p className="font-mono text-2xl font-bold tabular-nums text-card-foreground">
              {rows.toLocaleString('es-CO')}
              <span className="text-sm font-semibold text-muted-foreground">
                {' '}
                / {totalRows ? totalRows.toLocaleString('es-CO') : '—'} filas
              </span>
            </p>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <HeroChip icon={Gauge} label="Velocidad" value={rate} />
            <HeroChip icon={Layers} label="Página" value={page} />
            <HeroChip icon={Clock3} label="Tiempo" value={elapsedLabel} />
          </div>
        </div>
      </div>

      <div className="mt-6 border-t border-border pt-5">
        <PhaseStepper phaseIndex={phaseIndex} error={statusKind === 'error'} />
      </div>

      {task && <p className="mt-4 text-center text-sm text-muted-foreground sm:text-left">{task}</p>}
    </div>
  );
}

const LOG_TONE: Record<LogLevel, { ring: string; icon: string; Icon: React.ElementType }> = {
  SUCCESS: { ring: 'border-success/30 bg-success/10', icon: 'text-success', Icon: CheckCircle2 },
  ERROR: { ring: 'border-destructive/30 bg-destructive/10', icon: 'text-destructive', Icon: AlertTriangle },
  INFO: { ring: 'border-accent/30 bg-accent/10', icon: 'text-accent', Icon: Info },
};

function OperationTimeline({ logs }: { logs: Array<{ type: LogLevel; message: string }> }) {
  const [expanded, setExpanded] = useState(true);
  const scrollRef = useRef<HTMLOListElement>(null);

  // Autoscroll al evento más reciente (abajo) cuando hay novedades y está
  // desplegado. El neutralizador global de reduced-motion deja el salto seco.
  useEffect(() => {
    const el = scrollRef.current;
    if (el && expanded) el.scrollTop = el.scrollHeight;
  }, [logs, expanded]);

  return (
    <div className="bento-enter overflow-hidden rounded-2xl border border-border bg-card shadow-glow">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        aria-controls="registro-operativo"
        className="flex w-full items-center justify-between gap-3 border-b border-border px-6 py-4 text-left transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <span className="flex items-center gap-2">
          <h3 className="font-bold text-card-foreground">Registro operativo</h3>
          {logs.length > 0 && (
            <span className="rounded-full border border-border bg-background px-2 py-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground">
              {logs.length}
            </span>
          )}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
      </button>
      <div className="p-6">
        {logs.length === 0 ? (
          <EmptyState
            icon={FileSearch}
            title="Sin operaciones registradas"
            description="Ejecuta una vista previa o una descarga para ver aquí el registro paso a paso."
            hint=""
          />
        ) : expanded ? (
          <ol
            id="registro-operativo"
            ref={scrollRef}
            role="log"
            aria-live="polite"
            aria-label="Registro de operaciones"
            className="scrollbar-thin max-h-[260px] overflow-y-auto pr-1"
          >
            {logs.map((log, index) => {
              const tone = LOG_TONE[log.type];
              const isLast = index === logs.length - 1;
              const Icon = tone.Icon;
              return (
                <li key={`${log.type}-${index}`} className="relative flex gap-3 pb-3 last:pb-0">
                  {!isLast && <span className="absolute bottom-0 left-[13px] top-7 w-px bg-border" aria-hidden="true" />}
                  <span className={`relative z-10 mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${tone.ring}`}>
                    <Icon className={`h-3.5 w-3.5 ${tone.icon}`} />
                  </span>
                  <p className="pt-1 text-sm leading-5 text-card-foreground">{log.message}</p>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="text-sm text-muted-foreground">
            Registro colapsado · {logs.length} evento(s). Toca el encabezado para ver el detalle.
          </p>
        )}
      </div>
    </div>
  );
}

function ReadyDownloadPanel({
  job,
  onDownloadPart,
}: {
  job: ExportJobStatusResponse;
  onDownloadPart: (job: ExportJobStatusResponse, part: ExportJobPart) => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const expiresAt =
    job.parts[0]?.expiresAt ||
    (job.finishedAt ? new Date(new Date(job.finishedAt).valueOf() + EXPORT_AVAILABILITY_MS).toISOString() : null);
  const remainingMs = useCountdown(expiresAt);
  const expired = remainingMs !== null && remainingMs <= 0;

  // (Se quitó el auto-scroll al aparecer el ZIP: arrastraba la página sin pedirlo.
  // La señal in-place — anillo verde + botón de descarga + toast — y el cambio a la
  // vista de resultados ya orientan al usuario.)

  return (
    <div
      ref={cardRef}
      className="animate-fade-in-up rounded-2xl border border-success/40 bg-card p-6 shadow-[0_0_40px_rgba(7,137,48,0.16)]"
    >
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="glow-success flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-success/40 bg-success/10">
            <CheckCircle2 className="h-6 w-6 text-success" />
          </span>
          <div>
            <h3 className="font-bold text-card-foreground">ZIP listo para descargar</h3>
            <p className="text-sm text-muted-foreground">
              Puedes descargar el ZIP las veces que necesites mientras siga disponible.
            </p>
          </div>
        </div>
        {expired ? (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-destructive/30 bg-destructive/10 px-3 py-1 text-xs font-semibold text-destructive">
            <AlertTriangle className="h-3.5 w-3.5" />
            Enlace expirado
          </span>
        ) : (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-3 py-1 text-xs font-semibold tabular-nums text-success">
            <TimerReset className="h-3.5 w-3.5" />
            {remainingMs === null ? 'Disponible por 1 hora' : `Disponible ${formatCountdown(remainingMs)}`}
          </span>
        )}
      </div>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {job.parts.map((part) => (
          <button
            key={`${job.jobId}:${part.index}`}
            type="button"
            onClick={() => onDownloadPart(job, part)}
            disabled={expired}
            className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background px-4 py-3 text-left transition-[border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:border-border"
          >
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-card-foreground">{part.fileName}</span>
              <span className="block text-xs tabular-nums text-muted-foreground">
                {part.rowCount.toLocaleString('es-CO')} filas · {formatBytes(part.sizeBytes)}
              </span>
            </span>
            <Download className="h-4 w-4 shrink-0 text-accent" />
          </button>
        ))}
      </div>
      {expired && (
        <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Info className="h-4 w-4 shrink-0 text-accent" />
          El enlace de descarga expiró (la ventana es de 1 hora). Genera una nueva exportación.
        </p>
      )}
    </div>
  );
}

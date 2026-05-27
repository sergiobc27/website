import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Database,
  Download,
  FileArchive,
  FileSearch,
  Filter,
  Layers,
  LoaderCircle,
  MapPin,
  Rocket,
  Search,
  ShieldCheck,
  TimerReset,
} from 'lucide-react';
import { EmptyState } from './EmptyState';

const HISTORY_KEY = 'ideam-history';
const PRODUCTION_API_ORIGIN = 'https://ideam.sergiobc.com';
const MAX_OPERATION_LOGS = 80;
const EXPORT_AVAILABILITY_MS = 60 * 60 * 1000;

type StepId = 'consent' | 'variable' | 'territory' | 'advanced' | 'time' | 'execute';
type OutputFormat = 'csv' | 'json' | 'parquet';
type LogLevel = 'INFO' | 'SUCCESS' | 'ERROR';
type TimeMode = 'full' | 'custom';
type CatalogOptionStatus = 'idle' | 'loading' | 'ready' | 'error';

interface DatasetMeta {
  id: string;
  name: string;
  category: string;
  dateColumn?: string;
}

interface CatalogFilterDefinition {
  key: string;
  label: string;
  column: string;
}

interface MetaResponse {
  datasets: DatasetMeta[];
  departments: string[];
  previewLimit: number;
  exportPageSize: number;
  maxExportRows: number | null;
  catalogFilters: CatalogFilterDefinition[];
}

interface DateRangeResponse {
  datasetId: string;
  startDate: string | null;
  endDate: string | null;
  startYear: number | null;
  endYear: number | null;
}

interface OptionItem {
  value: string;
  label?: string;
  total: number;
}

interface StationHelperRow {
  code: string;
  name: string;
  department: string;
  municipality: string;
  zone: string;
  entity: string;
}

interface CoverageReport {
  department: string;
  configured_variants: string[];
  matched: Array<{ departamento: string; normalized: string; total: number }>;
  matched_rows: number;
  unmatched_rows: number;
  unmatched_discovered: Array<{ departamento: string; normalized: string; total: number }>;
}

interface PreviewResponse {
  datasetId: string;
  rowCount: number;
  rows: Record<string, unknown>[];
  summary: {
    rowCount: number;
    stationCount: number;
    municipalityCount: number;
    departmentCount: number;
    zoneCount: number;
    observedStart: string | null;
    observedEnd: string | null;
  };
  stationPoolSize: number;
  queryPlans: number;
  processingMs: number;
}

interface ExportJobPart {
  index: number;
  fileName: string;
  rowCount: number;
  sizeBytes: number;
  formats: string[];
  downloadPath: string;
  expiresAt?: string;
}

interface ExportJobStatusResponse {
  jobId: string;
  status: 'queued' | 'planning' | 'processing' | 'completed' | 'failed';
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  updatedAt: string;
  datasetId: string;
  datasetName: string;
  fileStem: string | null;
  warnings: string[];
  error: string | null;
  selectedFormats: string[];
  effectiveFormats: string[];
  rowCount: number;
  totalPages: number;
  completedPages: number;
  processedRows: number;
  queryPlans: number;
  stationPoolSize: number;
  parts: ExportJobPart[];
  metrics: DownloadMetrics | null;
}

interface ExportPlanPage {
  planIndex: number;
  where: string | null;
  rowCount: number;
  pageCount: number;
}

interface ExportPlanResponse {
  datasetId: string;
  fileStem: string;
  rowCount: number;
  pageSize: number;
  totalPages: number;
  queryPlans: number;
  stationPoolSize: number;
  replacements: Record<string, string>;
  planPages: ExportPlanPage[];
  processingMs: number;
}

interface ExportPageResponse {
  datasetId: string;
  planIndex: number;
  offset: number;
  returnedRows: number;
  rows: Record<string, unknown>[];
}

interface DownloadMetrics {
  fileName: string;
  rowCount: number;
  stationCount: number;
  municipalityCount: number;
  departmentCount: number;
  zoneCount: number;
  processingMs: number;
  sizeBytes: number;
  observedStart: string;
  observedEnd: string;
  queryPlans: number;
  stationPoolSize: number;
  archivePartCount: number;
  downloadedPages: number;
}

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

interface HistoryEntry extends DownloadMetrics {
  timestamp: string;
  variable: string;
  format: string;
  departments: string[];
  catalogFilters: Record<string, string[]>;
  jobId?: string;
  downloadPath?: string;
  availableUntil?: string;
}

function readHistory(): HistoryEntry[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveHistory(entry: HistoryEntry) {
  const history = readHistory();
  history.unshift(entry);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 30)));
}

function formatDateLabel(value: string | null | undefined) {
  if (!value) return 'Sin dato';
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleString('es-CO');
}

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '0 B';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDuration(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '0 s';
  if (value < 60000) return `${(value / 1000).toFixed(value < 10000 ? 1 : 0)} s`;

  const totalSeconds = Math.round(value / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
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

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function apiUrl(path: string) {
  if (path.startsWith('http')) return path;
  if (typeof window === 'undefined') return path;
  return window.location.hostname === 'ideam.sergiobc.com' ? path : `${PRODUCTION_API_ORIGIN}${path}`;
}

async function parseJsonResponse<T>(response: Response, fallbackMessage: string): Promise<T & { error?: string }> {
  const contentType = response.headers.get('content-type') || '';
  const bodyText = await response.text();

  if (!contentType.includes('application/json')) {
    const isHtml = bodyText.trimStart().startsWith('<!DOCTYPE') || bodyText.trimStart().startsWith('<html');
    const detail = isHtml
      ? 'El servicio respondio con una pagina HTML en vez de datos JSON. Recarga la pagina e intenta de nuevo.'
      : bodyText.slice(0, 240);
    throw new Error(`${fallbackMessage} ${detail}`);
  }

  try {
    return JSON.parse(bodyText) as T & { error?: string };
  } catch {
    throw new Error(`${fallbackMessage} La respuesta JSON esta corrupta o incompleta.`);
  }
}

async function apiJson<T>(path: string, init: RequestInit | undefined, fallbackMessage: string) {
  const response = await fetch(apiUrl(path), {
    ...init,
    cache: 'no-store',
    headers: {
      accept: 'application/json',
      ...(init?.headers || {}),
    },
  });
  const data = await parseJsonResponse<T>(response, fallbackMessage);
  if (!response.ok) {
    throw new Error(data.error || fallbackMessage);
  }
  return data;
}

function rowsToCsv(rows: Record<string, unknown>[]) {
  if (!rows.length) return '';

  const columns = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row).forEach((key) => set.add(key));
      return set;
    }, new Set<string>())
  );

  const escape = (value: unknown) => {
    const text = value === null || value === undefined ? '' : String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };

  const header = columns.join(',');
  const body = rows.map((row) => columns.map((column) => escape(row[column])).join(','));
  return [header, ...body].join('\n');
}

function createSummaryAccumulator() {
  return {
    stationCodes: new Set<string>(),
    municipalities: new Set<string>(),
    departments: new Set<string>(),
    zones: new Set<string>(),
    observedStartMs: null as number | null,
    observedEndMs: null as number | null,
  };
}

function updateSummaryAccumulator(
  accumulator: ReturnType<typeof createSummaryAccumulator>,
  rows: Record<string, unknown>[],
  dateColumn: string
) {
  rows.forEach((row) => {
    if (row.codigoestacion) accumulator.stationCodes.add(String(row.codigoestacion));
    if (row.municipio) accumulator.municipalities.add(String(row.municipio));
    if (row.departamento) accumulator.departments.add(String(row.departamento));
    if (row.zonahidrografica) accumulator.zones.add(String(row.zonahidrografica));
    if (row[dateColumn]) {
      const parsed = new Date(String(row[dateColumn]));
      if (!Number.isNaN(parsed.valueOf())) {
        const value = parsed.valueOf();
        accumulator.observedStartMs =
          accumulator.observedStartMs === null ? value : Math.min(accumulator.observedStartMs, value);
        accumulator.observedEndMs =
          accumulator.observedEndMs === null ? value : Math.max(accumulator.observedEndMs, value);
      }
    }
  });
}

function finalizeSummaryAccumulator(
  accumulator: ReturnType<typeof createSummaryAccumulator>,
  rowCount: number
) {
  return {
    rowCount,
    stationCount: accumulator.stationCodes.size,
    municipalityCount: accumulator.municipalities.size,
    departmentCount: accumulator.departments.size,
    zoneCount: accumulator.zones.size,
    observedStart: accumulator.observedStartMs ? new Date(accumulator.observedStartMs).toISOString() : '',
    observedEnd: accumulator.observedEndMs ? new Date(accumulator.observedEndMs).toISOString() : '',
  };
}

function summarizeRows(rows: Record<string, unknown>[], dateColumn: string) {
  const accumulator = createSummaryAccumulator();
  updateSummaryAccumulator(accumulator, rows, dateColumn);
  return finalizeSummaryAccumulator(accumulator, rows.length);
}

export function DataExtractor({ onRuntimeChange }: { onRuntimeChange?: (state: ExtractorRuntimeState) => void }) {
  const [meta, setMeta] = useState<MetaResponse | null>(null);
  const [step, setStep] = useState<StepId>('consent');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [datasetId, setDatasetId] = useState('');
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [catalogFilters, setCatalogFilters] = useState<Record<string, string[]>>({});
  const [catalogOptions, setCatalogOptions] = useState<Record<string, OptionItem[]>>({});
  const [catalogOptionStatus, setCatalogOptionStatus] = useState<Record<string, CatalogOptionStatus>>({});
  const [catalogOptionErrors, setCatalogOptionErrors] = useState<Record<string, string>>({});
  const [stationCodesText, setStationCodesText] = useState('');
  const [stationHelperRows, setStationHelperRows] = useState<StationHelperRow[]>([]);
  const [stationHelperLoading, setStationHelperLoading] = useState(false);
  const [coverageReports, setCoverageReports] = useState<CoverageReport[]>([]);
  const [coverageLoading, setCoverageLoading] = useState(false);
  const [dateRange, setDateRange] = useState<DateRangeResponse | null>(null);
  const [timeMode, setTimeMode] = useState<TimeMode>('full');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedFormats, setSelectedFormats] = useState<OutputFormat[]>(['csv']);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [downloadMetrics, setDownloadMetrics] = useState<DownloadMetrics | null>(null);
  const [currentJob, setCurrentJob] = useState<ExportJobStatusResponse | null>(null);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [transferProgress, setTransferProgress] = useState<TransferProgress | null>(null);
  const [logs, setLogs] = useState<Array<{ type: LogLevel; message: string }>>([]);
  const [isBusy, setIsBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [activeTask, setActiveTask] = useState('Esperando configuracion');
  const [operationStartedAt, setOperationStartedAt] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const handledJobIdsRef = useRef<Set<string>>(new Set());
  const pollFailuresRef = useRef(0);

  const steps = useMemo(
    () => [
      { id: 'consent' as StepId, title: 'Consentimiento', icon: ShieldCheck },
      { id: 'variable' as StepId, title: 'Variable', icon: Database },
      { id: 'territory' as StepId, title: 'Territorio', icon: MapPin },
      { id: 'advanced' as StepId, title: 'Filtros avanzados', icon: Filter },
      { id: 'time' as StepId, title: 'Temporalidad', icon: Calendar },
      { id: 'execute' as StepId, title: 'Ejecucion', icon: Rocket },
    ],
    []
  );

  const selectedDataset = useMemo(
    () => meta?.datasets.find((dataset) => dataset.id === datasetId) || null,
    [meta, datasetId]
  );

  const selectedStepIndex = steps.findIndex((item) => item.id === step);

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
      departments: selectedDepartments.join(', ') || 'Sin seleccion',
      advancedSelections,
      stationCodes: parseStationCodes(stationCodesText),
      formats: selectedFormats,
    };
  }, [catalogFilters, meta?.catalogFilters, selectedDepartments, selectedFormats, stationCodesText]);

  const previewColumns = preview?.rows.length ? Object.keys(preview.rows[0]).slice(0, 8) : [];

  const appendLog = useCallback((type: LogLevel, message: string) => {
    setLogs((current) => {
      const last = current[current.length - 1];
      if (last?.type === type && last.message === message) {
        return current;
      }
      return [...current.slice(-(MAX_OPERATION_LOGS - 1)), { type, message }];
    });
  }, []);

  const triggerBrowserDownload = useCallback((downloadPath: string, fileName: string) => {
    const link = document.createElement('a');
    link.href = downloadPath;
    link.download = fileName;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
  }, []);

  const downloadJobPart = useCallback((job: ExportJobStatusResponse, part: ExportJobPart) => {
    triggerBrowserDownload(apiUrl(part.downloadPath), part.fileName);
    appendLog('SUCCESS', `Descarga iniciada: ${part.fileName}. El enlace seguira disponible durante 1 hora.`);
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
    }

    appendLog(
      job.processedRows > 0 ? 'SUCCESS' : 'INFO',
      job.processedRows > 0
        ? `Job listo: ZIP unico organizado, ${job.processedRows.toLocaleString('es-CO')} filas y ${formatDuration(job.metrics?.processingMs || 0)}. Usa el boton de descarga para guardarlo.`
        : 'La consulta no encontro filas con esos filtros. Se genero un ZIP con archivos vacios para dejar evidencia de la ejecucion.'
    );
  }, [appendLog, catalogFilters, datasetId, selectedDataset?.name, selectedDepartments]);

  useEffect(() => {
    const boot = async () => {
      appendLog('INFO', 'Cargando metadata operativa del sistema...');
      try {
        const data = await apiJson<MetaResponse>('/api/meta', undefined, 'No fue posible cargar la metadata.');
        setMeta(data);
        setDatasetId(data.datasets[0]?.id || '');
        appendLog('SUCCESS', 'Metadata cargada correctamente.');
      } catch (error) {
        appendLog('ERROR', error instanceof Error ? error.message : 'Error cargando metadata.');
      }
    };
    void boot();
  }, []);

  useEffect(() => {
    const loadDateRange = async () => {
      if (!datasetId) return;
      appendLog('INFO', 'Consultando rango temporal disponible...');
      try {
        const data = await apiJson<DateRangeResponse>(
          `/api/date-range?datasetId=${encodeURIComponent(datasetId)}`,
          undefined,
          'No fue posible cargar el rango temporal.'
        );
        setDateRange(data);
        setStartDate(data.startDate || '');
        setEndDate(data.endDate || '');
        appendLog('SUCCESS', `Rango temporal disponible: ${data.startYear || 'N/D'} - ${data.endYear || 'N/D'}.`);
      } catch (error) {
        appendLog('ERROR', error instanceof Error ? error.message : 'Error cargando rango temporal.');
      }
    };
    void loadDateRange();
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
    setStationCodesText('');
    setStationHelperRows([]);
    setPreview(null);
    setDownloadMetrics(null);
  }, [datasetId, selectedDepartments.join('|')]);

  const loadCatalogOptions = useCallback(async (definition: CatalogFilterDefinition, force = false) => {
    if (!datasetId || !selectedDepartments.length) {
      setCatalogOptionErrors((current) => ({
        ...current,
        [definition.key]: 'Selecciona variable y departamento para cargar este filtro.',
      }));
      setCatalogOptionStatus((current) => ({ ...current, [definition.key]: 'error' }));
      return;
    }

    const currentStatus = catalogOptionStatus[definition.key] || 'idle';
    if (!force && (currentStatus === 'loading' || currentStatus === 'ready')) return;

    setCatalogOptionErrors((current) => {
      const next = { ...current };
      delete next[definition.key];
      return next;
    });
    setCatalogOptionStatus((current) => ({ ...current, [definition.key]: 'loading' }));

    try {
      const data = await apiJson<{ options?: OptionItem[] }>('/api/catalog-options', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          datasetId,
          departments: selectedDepartments,
          catalogFilters,
          attributeKey: definition.key,
        }),
      }, `No fue posible cargar ${definition.label}.`);

      setCatalogOptions((current) => ({ ...current, [definition.key]: data.options || [] }));
      setCatalogOptionStatus((current) => ({ ...current, [definition.key]: 'ready' }));
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
    if (!acceptedTerms || !datasetId || !selectedDepartments.length || !meta?.catalogFilters?.length) return;
    meta.catalogFilters.forEach((definition) => {
      void loadCatalogOptions(definition);
    });
  }, [acceptedTerms, datasetId, loadCatalogOptions, meta?.catalogFilters, selectedDepartments.length]);

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

    const pollJob = async () => {
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
          totalParts: Math.max(data.totalPages, 1),
          completedParts: data.parts.length,
        });

        if (data.status === 'queued') {
          setProgress(4);
          setActiveTask('Job en cola...');
        } else if (data.status === 'planning') {
          setProgress(8);
          setActiveTask('Planificando exportacion...');
        } else if (data.status === 'processing') {
          const ratio = data.totalPages ? data.completedPages / data.totalPages : 0;
          setProgress(10 + Math.round(ratio * 80));
          setActiveTask(`Procesando ${data.completedPages}/${Math.max(data.totalPages, 1)} paginas...`);
        } else if (data.status === 'completed') {
          setProgress(100);
          setActiveTask('ZIP listo para descargar');
          setIsBusy(false);
          await finalizeCompletedJob(data);
        } else if (data.status === 'failed') {
          setProgress(100);
          setActiveTask('Error en descarga');
          setIsBusy(false);
          setCurrentJobId(null);
          appendLog('ERROR', data.error || 'El job de exportacion fallo.');
        }
      } catch (error) {
        if (cancelled) return;
        pollFailuresRef.current += 1;
        setIsBusy(false);
        appendLog('ERROR', error instanceof Error ? error.message : 'Error consultando el job.');
        if (pollFailuresRef.current >= 3) {
          setCurrentJobId(null);
          setActiveTask('No fue posible consultar el job');
        }
      }
    };

    void pollJob();
    const timer = window.setInterval(() => {
      void pollJob();
    }, 2000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [currentJobId, finalizeCompletedJob]);

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
    appendLog('INFO', 'Consultando estaciones del catalogo segun los filtros actuales...');
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
      setDownloadMetrics(null);
      setTransferProgress(null);
      setCurrentJob(null);
      setCurrentJobId(null);
      pollFailuresRef.current = 0;
      setProgress(2);
      setActiveTask('Creando job de exportacion...');

      const downloadPayload = executionPayload;
      appendLog('INFO', 'Creando job asincrono de exportacion...');

      const data = await apiJson<ExportJobStatusResponse>('/api/jobs', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ...downloadPayload,
          formats: selectedFormats,
        }),
      }, 'No fue posible crear el job de exportacion.');

      handledJobIdsRef.current.delete(data.jobId);
      setCurrentJobId(data.jobId);
      setCurrentJob(data);
      setTransferProgress({
        totalPages: Math.max(data.totalPages, 1),
        completedPages: data.completedPages,
        totalRows: data.rowCount,
        downloadedRows: data.processedRows,
        totalParts: Math.max(data.totalPages, 1),
        completedParts: data.parts.length,
      });
      setProgress(5);
      setActiveTask('Job creado, esperando procesamiento...');
      appendLog('SUCCESS', `Job ${data.jobId.slice(0, 8)} creado. El backend continuara la exportacion por lotes.`);
    } catch (error) {
      setProgress(100);
      setActiveTask('Error en descarga');
      setIsBusy(false);
      appendLog('ERROR', error instanceof Error ? error.message : 'Error durante la descarga.');
    }
  };

  const goNext = () => {
    try {
      if (step === 'consent' && !acceptedTerms) {
        throw new Error('Debes aceptar el aviso legal para iniciar.');
      }
      if (step === 'variable' && !datasetId) {
        throw new Error('Selecciona una variable para continuar.');
      }
      if (step === 'territory' && !selectedDepartments.length) {
        throw new Error('Selecciona al menos un departamento.');
      }
      if (step === 'time' && (!startDate || !endDate || startDate > endDate)) {
        throw new Error('Configura un rango temporal valido.');
      }
      setStep(steps[Math.min(selectedStepIndex + 1, steps.length - 1)].id);
    } catch (error) {
      appendLog('ERROR', error instanceof Error ? error.message : 'No fue posible continuar.');
    }
  };

  const goBack = () => {
    setStep(steps[Math.max(selectedStepIndex - 1, 0)].id);
  };

  const runtimeRows = transferProgress?.downloadedRows ?? downloadMetrics?.rowCount ?? preview?.rowCount ?? 0;
  const runtimeTotalRows = transferProgress?.totalRows ?? preview?.rowCount ?? downloadMetrics?.rowCount ?? 0;
  const runtimeElapsedMs = isBusy ? elapsedMs : downloadMetrics?.processingMs ?? preview?.processingMs ?? 0;
  const runtimePages = transferProgress
    ? `${transferProgress.completedPages}/${transferProgress.totalPages}`
    : downloadMetrics
      ? `${downloadMetrics.downloadedPages}/${downloadMetrics.downloadedPages}`
      : '0/0';
  const runtimeParts = transferProgress
    ? `${transferProgress.completedParts}/${transferProgress.totalParts}`
    : downloadMetrics
      ? `${downloadMetrics.archivePartCount}/${downloadMetrics.archivePartCount}`
      : '0/0';
  const readyDownloadJob = currentJob?.status === 'completed' && currentJob.parts.length ? currentJob : null;

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

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-12 min-h-[calc(100vh-7rem)]">
      <div className="space-y-6 xl:col-span-4 xl:sticky xl:top-6 self-start">
        <div className="bg-card border border-border rounded-xl p-6 shadow-[0_0_40px_rgba(201,162,39,0.1)]">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Paso {selectedStepIndex + 1} de {steps.length}</p>
              <h2 className="text-card-foreground text-xl font-bold">Configurar descarga</h2>
            </div>
            <span className="rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">
              {steps[selectedStepIndex]?.title}
            </span>
          </div>
          <StepPanel
            step={step}
            meta={meta}
            datasetId={datasetId}
            selectedDataset={selectedDataset}
            acceptedTerms={acceptedTerms}
            onAcceptedTermsChange={setAcceptedTerms}
            selectedDepartments={selectedDepartments}
            onToggleDepartment={toggleDepartment}
            catalogFilters={catalogFilters}
            catalogOptions={catalogOptions}
            catalogOptionStatus={catalogOptionStatus}
            catalogOptionErrors={catalogOptionErrors}
            onToggleCatalogValue={toggleCatalogValue}
            onLoadCatalogOptions={loadCatalogOptions}
            canLoadCatalogOptions={Boolean(datasetId && selectedDepartments.length)}
            stationCodesText={stationCodesText}
            onStationCodesTextChange={setStationCodesText}
            onLoadStationHelper={loadStationHelper}
            stationHelperRows={stationHelperRows}
            stationHelperLoading={stationHelperLoading}
            dateRange={dateRange}
            timeMode={timeMode}
            setTimeMode={setTimeMode}
            startDate={startDate}
            endDate={endDate}
            onStartDateChange={setStartDate}
            onEndDateChange={setEndDate}
            selectedFormats={selectedFormats}
            onToggleOutputFormat={toggleOutputFormat}
            onDatasetChange={setDatasetId}
            selectionSummary={selectionSummary}
            coverageReports={coverageReports}
            coverageLoading={coverageLoading}
            onRunPreview={runPreview}
            onRunDownload={runDownload}
            isBusy={isBusy}
          />

          <div className="mt-6 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={goBack}
              disabled={selectedStepIndex === 0}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-semibold text-card-foreground transition-all hover:border-accent/40 disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4" />
              Atras
            </button>
            <button
              type="button"
              onClick={goNext}
              disabled={selectedStepIndex === steps.length - 1}
              className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-primary to-accent px-4 py-2 text-sm font-semibold text-primary-foreground transition-all hover:shadow-[0_0_24px] hover:shadow-accent/40 disabled:opacity-50"
            >
              Siguiente
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-4 shadow-[0_0_40px_rgba(201,162,39,0.1)]">
          <h2 className="text-card-foreground text-sm font-bold mb-3">Navegacion del flujo</h2>
          <div className="grid grid-cols-2 gap-2">
            {steps.map((item, index) => {
              const Icon = item.icon;
              const isActive = step === item.id;
              const isDone = selectedStepIndex > index && acceptedTerms;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    if (item.id !== 'consent' && !acceptedTerms) {
                      appendLog('ERROR', 'Debes aceptar el consentimiento antes de abrir otros pasos.');
                      return;
                    }
                    setStep(item.id);
                  }}
                  className={`flex min-h-16 items-center gap-2 rounded-lg border px-3 py-2 text-left transition-all ${
                    isActive
                      ? 'border-accent bg-accent/10 text-card-foreground'
                      : isDone
                      ? 'border-success/30 bg-success/10 text-card-foreground'
                      : 'border-border bg-background text-muted-foreground hover:border-accent/40'
                  }`}
                >
                  {isDone ? <CheckCircle2 className="h-4 w-4 shrink-0 text-success" /> : <Icon className="h-4 w-4 shrink-0 text-accent" />}
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-bold">{item.title}</span>
                    <span className="block text-[11px] opacity-80">Paso {index + 1}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="xl:col-span-8 space-y-6">
        <div className="bg-card border border-border rounded-xl p-6 shadow-[0_0_40px_rgba(201,162,39,0.1)]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-card-foreground font-bold">Estado de ejecucion</h3>
            <span className="text-sm font-mono text-accent">{progress}%</span>
          </div>
          <div className="relative overflow-hidden rounded-full bg-muted h-4 mb-5">
            <div
              className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-300 shadow-[0_0_20px] shadow-accent/60"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <MetricCard title="Variable" value={selectedDataset?.name || 'Sin seleccion'} icon={Database} />
            <MetricCard
              title="Filas"
              value={`${runtimeRows.toLocaleString('es-CO')} / ${runtimeTotalRows.toLocaleString('es-CO')}`}
              icon={FileSearch}
            />
            <MetricCard title="Paginas" value={runtimePages} icon={Layers} />
            <MetricCard title="ZIP" value={readyDownloadJob ? '1 archivo' : runtimeParts} icon={FileArchive} />
            <MetricCard title="Estaciones" value={String(downloadMetrics?.stationCount || preview?.summary.stationCount || 0)} icon={MapPin} />
            <MetricCard title="Tiempo" value={formatDuration(runtimeElapsedMs)} icon={Clock3} />
            <MetricCard title="Peso" value={formatBytes(downloadMetrics?.sizeBytes || 0)} icon={Download} />
            <MetricCard title="Proceso" value={activeTask} icon={LoaderCircle} />
          </div>
        </div>

        {readyDownloadJob && (
          <div className="bg-card border border-success/30 rounded-xl p-6 shadow-[0_0_40px_rgba(32,197,121,0.12)]">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-card-foreground font-bold">ZIP listo para descargar</h3>
                <p className="text-sm text-muted-foreground">
                  Puedes descargar el ZIP las veces que necesites mientras siga disponible.
                </p>
              </div>
              <span className="rounded-full border border-success/30 bg-success/10 px-3 py-1 text-xs font-semibold text-success">
                Disponible por 1 hora
              </span>
            </div>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {readyDownloadJob.parts.map((part) => {
                const partKey = `${readyDownloadJob.jobId}:${part.index}`;
                return (
                  <button
                    key={partKey}
                    type="button"
                    onClick={() => downloadJobPart(readyDownloadJob, part)}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-4 py-3 text-left transition-all hover:border-accent/40"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-card-foreground">{part.fileName}</span>
                      <span className="block text-xs text-muted-foreground">
                        {part.rowCount.toLocaleString('es-CO')} filas | {formatBytes(part.sizeBytes)}
                      </span>
                    </span>
                    <Download className="h-4 w-4 shrink-0 text-accent" />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="bg-card border border-border rounded-xl p-6 shadow-[0_0_40px_rgba(201,162,39,0.1)]">
            <h3 className="text-card-foreground font-bold mb-4">Resumen configurado</h3>
            <div className="space-y-3 text-sm">
              <SummaryRow label="Variable" value={selectedDataset?.name || 'Sin seleccion'} />
              <SummaryRow label="Departamentos" value={selectionSummary.departments} />
              <SummaryRow label="Rango temporal" value={`${startDate || 'N/D'} -> ${endDate || 'N/D'}`} />
              <SummaryRow label="Estaciones manuales" value={String(selectionSummary.stationCodes.length)} />
              <SummaryRow
                label="Filtros avanzados"
                value={
                  selectionSummary.advancedSelections.length
                    ? selectionSummary.advancedSelections.map((item) => `${item.label}: ${item.values.length}`).join(' | ')
                    : 'Sin filtros avanzados'
                }
              />
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-6 shadow-[0_0_40px_rgba(201,162,39,0.1)]">
            <h3 className="text-card-foreground font-bold mb-4">Salida esperada</h3>
            <div className="space-y-3 text-sm">
              <SummaryRow label="Entrega" value="ZIP unico organizado por carpetas" />
              <SummaryRow label="Formatos" value={selectionSummary.formats.length ? selectionSummary.formats.join(', ').toUpperCase() : 'Sin seleccion'} />
              <SummaryRow label="Pool de estaciones" value={String(downloadMetrics?.stationPoolSize || preview?.stationPoolSize || 0)} />
              <SummaryRow label="Planes de consulta" value={String(downloadMetrics?.queryPlans || preview?.queryPlans || 0)} />
              <SummaryRow label="ZIP esperado" value={readyDownloadJob || downloadMetrics ? '1 archivo' : 'Pendiente'} />
              <SummaryRow label="Municipios cubiertos" value={String(downloadMetrics?.municipalityCount || preview?.summary.municipalityCount || 0)} />
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-[0_0_40px_rgba(201,162,39,0.1)]">
          <div className="px-6 py-4 border-b border-border">
            <h3 className="text-card-foreground font-bold">Registro operativo</h3>
          </div>
          <div className="p-6">
            {logs.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="bg-black rounded-lg p-4 h-[240px] overflow-y-auto font-mono text-sm">
                {logs.map((log, index) => (
                  <div key={`${log.type}-${index}`} className="mb-1">
                    <span
                      className={`font-bold ${
                        log.type === 'SUCCESS' ? 'text-success' : log.type === 'ERROR' ? 'text-destructive' : 'text-accent'
                      }`}
                    >
                      [{log.type}]
                    </span>
                    <span className="text-gray-200 ml-2">{log.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-[0_0_40px_rgba(201,162,39,0.1)]">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <h3 className="text-card-foreground font-bold">Vista previa de resultados</h3>
            <span className="text-muted-foreground text-sm font-mono">
              {preview?.rowCount?.toLocaleString('es-CO') || 0} filas encontradas
            </span>
          </div>
          <div className="p-6">
            {!preview?.rows?.length ? (
              <EmptyState />
            ) : (
              <>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  <MetricCard title="Muestra" value={String(preview.rows.length)} icon={Search} />
                  <MetricCard title="Estaciones" value={String(preview.summary.stationCount)} icon={MapPin} />
                  <MetricCard title="Municipios" value={String(preview.summary.municipalityCount)} icon={Layers} />
                  <MetricCard title="Tiempo" value={formatDuration(preview.processingMs)} icon={TimerReset} />
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-muted-foreground border-b border-border">
                      <tr>
                        {previewColumns.map((column) => (
                          <th key={column} className="text-left p-3 font-mono font-bold">
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

        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-[0_0_40px_rgba(201,162,39,0.1)]">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <h3 className="text-card-foreground font-bold">Metricas de descarga</h3>
            <span className="text-muted-foreground text-sm font-mono">{downloadMetrics?.fileName || 'Sin ejecucion final'}</span>
          </div>
          <div className="p-6">
            {!downloadMetrics ? (
              <EmptyState />
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
}: {
  step: StepId;
  meta: MetaResponse | null;
  datasetId: string;
  selectedDataset: DatasetMeta | null;
  acceptedTerms: boolean;
  onAcceptedTermsChange: (value: boolean) => void;
  selectedDepartments: string[];
  onToggleDepartment: (department: string) => void;
  catalogFilters: Record<string, string[]>;
  catalogOptions: Record<string, OptionItem[]>;
  catalogOptionStatus: Record<string, CatalogOptionStatus>;
  catalogOptionErrors: Record<string, string>;
  onToggleCatalogValue: (filterKey: string, value: string) => void;
  onLoadCatalogOptions: (definition: CatalogFilterDefinition, force?: boolean) => void;
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
}) {
  const [filterSearch, setFilterSearch] = useState<Record<string, string>>({});

  if (step === 'consent') {
    return (
      <Section title="Aviso legal" icon={ShieldCheck}>
        <div className="rounded-lg border border-border bg-background p-4 text-sm leading-6 text-muted-foreground">
          Esta herramienta fue creada para fines academicos e investigativos. La informacion proviene de IDEAM y
          Datos Abiertos Colombia. El usuario conserva responsabilidad sobre el tratamiento posterior de los datos y su
          uso.
        </div>
        <label className="flex items-start gap-3 rounded-lg border border-border bg-background p-4">
          <input type="checkbox" checked={acceptedTerms} onChange={(event) => onAcceptedTermsChange(event.target.checked)} />
          <span className="text-sm text-card-foreground font-medium">
            Acepto los terminos y entiendo que debo marcar este consentimiento para continuar con la configuracion y la descarga.
          </span>
        </label>
      </Section>
    );
  }

  if (step === 'variable') {
    return (
      <Section title="Variable de trabajo" icon={Database}>
        <SelectInput label="Variable hidrica o meteorologica" value={datasetId} onChange={onDatasetChange}>
          {(meta?.datasets || []).map((dataset) => (
            <option key={dataset.id} value={dataset.id}>
              {dataset.name} · {dataset.category}
            </option>
          ))}
        </SelectInput>
        <div className="rounded-lg border border-border bg-background p-4 text-sm text-muted-foreground">
          <p className="font-semibold text-card-foreground mb-1">{selectedDataset?.name || 'Sin seleccion'}</p>
          <p>Dataset: {selectedDataset?.id || 'N/D'}</p>
          <p>Categoria: {selectedDataset?.category || 'N/D'}</p>
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
        <div className="flex flex-wrap gap-2">
          {(meta?.departments || []).map((department) => (
            <button
              key={department}
              type="button"
              onClick={() => onToggleDepartment(department)}
              className={`rounded-full border px-3 py-2 text-xs font-semibold transition-all ${
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
          Seleccion actual: {selectedDepartments.length ? selectedDepartments.join(', ') : 'Sin departamentos seleccionados'}
        </div>
      </Section>
    );
  }

  if (step === 'advanced') {
    return (
      <Section title="Personalizacion avanzada" icon={Filter}>
        <div className="rounded-lg border border-border bg-background p-4 text-sm text-muted-foreground">
          Estos catalogos se precargan por dataset y departamento para que la seleccion sea mas rapida. La descarga
          final sigue aplicando fechas, municipios, estaciones y demas filtros exactamente como los selecciones.
        </div>
        {(meta?.catalogFilters || []).map((definition) => {
          const status = catalogOptionStatus[definition.key] || 'idle';
          const selectedCount = (catalogFilters[definition.key] || []).length;
          const search = normalizeText(filterSearch[definition.key] || '');
          const options = (catalogOptions[definition.key] || []).filter((option) =>
            normalizeText(`${option.label || option.value} ${option.total}`).includes(search)
          );
          const actionLabel = status === 'ready' ? 'Actualizar' : status === 'error' ? 'Reintentar' : 'Cargar';

          return (
            <div key={definition.key} className="space-y-2">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <label className="text-sm font-semibold text-card-foreground">{definition.label}</label>
                <div className="flex items-center gap-2">
                  <span className="rounded-full border border-border bg-card px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                    {selectedCount} seleccionados
                  </span>
                  <button
                    type="button"
                    onClick={() => onLoadCatalogOptions(definition, status === 'ready')}
                    disabled={!canLoadCatalogOptions || status === 'loading'}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-[11px] font-semibold text-card-foreground hover:border-accent/40 disabled:opacity-50"
                  >
                    {status === 'loading' && <LoaderCircle className="h-3.5 w-3.5 animate-spin text-accent" />}
                    {actionLabel}
                  </button>
                </div>
              </div>
              <input
                value={filterSearch[definition.key] || ''}
                onFocus={() => {
                  if (status === 'idle' && canLoadCatalogOptions) onLoadCatalogOptions(definition);
                }}
                onChange={(event) => setFilterSearch((current) => ({ ...current, [definition.key]: event.target.value }))}
                placeholder={`Buscar ${definition.label.toLowerCase()}`}
                disabled={status === 'idle' || status === 'loading'}
                className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-card-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:opacity-60"
              />
              <div className="max-h-48 overflow-y-auto rounded-lg border border-border bg-background p-3">
                {status === 'idle' ? (
                  <div className="flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                    <span>{canLoadCatalogOptions ? 'Este catalogo se prepara automaticamente.' : 'Completa variable y departamento.'}</span>
                    <button
                      type="button"
                      onClick={() => onLoadCatalogOptions(definition)}
                      disabled={!canLoadCatalogOptions}
                      className="inline-flex items-center justify-center rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-card-foreground hover:border-accent/40 disabled:opacity-50"
                    >
                      Cargar opciones
                    </button>
                  </div>
                ) : status === 'loading' && !options.length ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <LoaderCircle className="h-4 w-4 animate-spin text-accent" />
                    Cargando opciones disponibles...
                  </div>
                ) : status === 'error' ? (
                  <div className="flex flex-col gap-3 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between">
                    <span>{catalogOptionErrors[definition.key] || 'No fue posible cargar este filtro.'}</span>
                    <button
                      type="button"
                      onClick={() => onLoadCatalogOptions(definition, true)}
                      className="inline-flex items-center justify-center rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-card-foreground hover:border-accent/40"
                    >
                      Reintentar
                    </button>
                  </div>
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
                      {options.slice(0, 80).map((option) => (
                        <button
                          key={`${definition.key}-${option.value}`}
                          type="button"
                          onClick={() => onToggleCatalogValue(definition.key, option.value)}
                          className={`rounded-full border px-3 py-2 text-xs font-semibold transition-all ${
                            (catalogFilters[definition.key] || []).includes(option.value)
                              ? 'border-accent bg-accent/15 text-accent'
                              : 'border-border bg-card text-muted-foreground hover:border-accent/40'
                          }`}
                        >
                          {option.label || option.value} ({option.total})
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-card-foreground">Codigos de estacion manuales</label>
          <textarea
            value={stationCodesText}
            onChange={(event) => onStationCodesTextChange(event.target.value)}
            rows={4}
            placeholder="Ej: 21205790, 29045180"
            className="w-full rounded-lg border border-border bg-input px-4 py-3 text-card-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
          />
          <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
            <span className="text-xs text-muted-foreground">
              Estaciones cargadas manualmente: {selectionSummary.stationCodes.length}
            </span>
            <button
              type="button"
              onClick={onLoadStationHelper}
              disabled={stationHelperLoading}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-semibold text-card-foreground hover:border-accent/40 disabled:opacity-50"
            >
              <Search className="h-4 w-4" />
              {stationHelperLoading ? 'Consultando...' : 'Ver estaciones filtradas'}
            </button>
          </div>
          {stationHelperRows.length > 0 && (
            <div className="max-h-52 overflow-y-auto rounded-lg border border-border bg-background">
              <table className="w-full text-xs">
                <thead className="border-b border-border text-muted-foreground">
                  <tr>
                    <th className="p-2 text-left">Codigo</th>
                    <th className="p-2 text-left">Nombre</th>
                    <th className="p-2 text-left">Municipio</th>
                  </tr>
                </thead>
                <tbody>
                  {stationHelperRows.map((item) => (
                    <tr key={`${item.code}-${item.name}`} className="border-b border-border">
                      <td className="p-2 font-mono text-card-foreground">{item.code}</td>
                      <td className="p-2 text-card-foreground">{item.name}</td>
                      <td className="p-2 text-muted-foreground">{item.municipality}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Section>
    );
  }

  if (step === 'time') {
    return (
      <Section title="Marco temporal" icon={Calendar}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ChoiceCard active={timeMode === 'full'} onClick={() => setTimeMode('full')} title="Todo el historico" description="Usar todo el rango disponible" />
          <ChoiceCard active={timeMode === 'custom'} onClick={() => setTimeMode('custom')} title="Rango personalizado" description="Definir fechas exactas" />
        </div>
        <div className="rounded-lg border border-border bg-background p-4 text-sm text-muted-foreground">
          Rango detectado: {dateRange?.startDate || 'N/D'} {'->'} {dateRange?.endDate || 'N/D'} ({dateRange?.startYear || 'N/D'} -{' '}
          {dateRange?.endYear || 'N/D'})
        </div>
        {timeMode === 'custom' ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <InputField label="Fecha inicio" type="date" value={startDate} onChange={onStartDateChange} />
            <InputField label="Fecha fin" type="date" value={endDate} onChange={onEndDateChange} />
          </div>
        ) : (
          <div className="rounded-lg border border-success/30 bg-success/10 p-4 text-sm text-success">
            Se usara automaticamente el rango completo disponible para la variable seleccionada.
          </div>
        )}
      </Section>
    );
  }

  return (
    <Section title="Ejecucion y descarga" icon={Rocket}>
      <div className="rounded-lg border border-border bg-background p-4 text-sm text-muted-foreground space-y-2">
        <p>
          <span className="font-semibold text-card-foreground">Departamentos:</span> {selectionSummary.departments}
        </p>
        <p>
          <span className="font-semibold text-card-foreground">Filtros avanzados:</span>{' '}
          {selectionSummary.advancedSelections.length
            ? selectionSummary.advancedSelections.map((item) => `${item.label} (${item.values.length})`).join(' · ')
            : 'Sin filtros avanzados'}
        </p>
        <p>
          <span className="font-semibold text-card-foreground">Estaciones manuales:</span> {selectionSummary.stationCodes.length}
        </p>
      </div>

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
          disabled={isBusy}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-3 text-sm font-semibold text-card-foreground hover:border-accent/40 disabled:opacity-50"
        >
          <FileSearch className="h-4 w-4" />
          Vista previa
        </button>
        <button
          type="button"
          onClick={onRunDownload}
          disabled={isBusy || coverageLoading}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-primary to-accent px-4 py-3 text-sm font-semibold text-primary-foreground hover:shadow-[0_0_24px] hover:shadow-accent/40 disabled:opacity-50"
        >
          {coverageLoading ? <ShieldCheck className="h-4 w-4" /> : <Download className="h-4 w-4" />}
          {coverageLoading ? 'Validando cobertura...' : 'Descargar ZIP'}
        </button>
      </div>

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
      className={`rounded-xl border p-4 text-left transition-all ${
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
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="text-muted-foreground text-sm mb-2 flex items-center gap-2 font-semibold">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full bg-input text-card-foreground px-4 py-2 rounded-lg border border-border focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all"
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
  return (
    <div>
      <label className="text-muted-foreground text-sm mb-2 flex items-center gap-2 font-semibold">{label}</label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full bg-input text-card-foreground px-4 py-2 rounded-lg border border-border focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all"
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
    <div className="rounded-lg border border-border bg-background p-4 min-h-[96px]">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-xs font-semibold text-muted-foreground">{title}</span>
        <Icon className="h-4 w-4 text-accent" />
      </div>
      <p className="text-sm font-bold leading-6 text-card-foreground break-words">{value}</p>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
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
import parquetWasmUrl from 'parquet-wasm/esm/parquet_wasm_bg.wasm?url';
import { EmptyState } from './EmptyState';

const HISTORY_KEY = 'ideam-history';
const ARCHIVE_PART_ROW_LIMIT = 100000;

type StepId = 'consent' | 'variable' | 'territory' | 'advanced' | 'time' | 'execute';
type OutputFormat = 'csv' | 'json' | 'parquet';
type LogLevel = 'INFO' | 'SUCCESS' | 'ERROR';
type DepartmentMode = 'all' | 'selected';
type TimeMode = 'full' | 'custom';

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
  if (value < 1000) return `${Math.round(value)} ms`;
  if (value < 60000) return `${(value / 1000).toFixed(1)} s`;

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
  const [departmentMode, setDepartmentMode] = useState<DepartmentMode>('all');
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [catalogFilters, setCatalogFilters] = useState<Record<string, string[]>>({});
  const [catalogOptions, setCatalogOptions] = useState<Record<string, OptionItem[]>>({});
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
  const [transferProgress, setTransferProgress] = useState<TransferProgress | null>(null);
  const [logs, setLogs] = useState<Array<{ type: LogLevel; message: string }>>([]);
  const [isBusy, setIsBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [activeTask, setActiveTask] = useState('Esperando configuracion');
  const [operationStartedAt, setOperationStartedAt] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);

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
    const departments = departmentMode === 'selected' ? selectedDepartments : [];
    return {
      datasetId,
      departments,
      catalogFilters,
      stationCodes: parseStationCodes(stationCodesText),
      startDate,
      endDate,
    };
  }, [catalogFilters, datasetId, departmentMode, endDate, selectedDepartments, startDate, stationCodesText]);

  const selectionSummary = useMemo(() => {
    const advancedSelections = (meta?.catalogFilters || [])
      .map((item) => ({ label: item.label, values: catalogFilters[item.key] || [] }))
      .filter((item) => item.values.length);
    return {
      departments: departmentMode === 'all' ? 'Todos los departamentos' : selectedDepartments.join(', ') || 'Sin seleccion',
      advancedSelections,
      stationCodes: parseStationCodes(stationCodesText),
      formats: selectedFormats,
    };
  }, [catalogFilters, departmentMode, meta?.catalogFilters, selectedDepartments, selectedFormats, stationCodesText]);

  const previewColumns = preview?.rows.length ? Object.keys(preview.rows[0]).slice(0, 8) : [];

  const appendLog = (type: LogLevel, message: string) => {
    setLogs((current) => [...current, { type, message }]);
  };

  useEffect(() => {
    const boot = async () => {
      appendLog('INFO', 'Cargando metadata operativa del sistema...');
      try {
        const response = await fetch('/api/meta');
        const data = (await response.json()) as MetaResponse & { error?: string };
        if (!response.ok) {
          throw new Error(data.error || 'No fue posible cargar la metadata.');
        }
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
        const response = await fetch(`/api/date-range?datasetId=${encodeURIComponent(datasetId)}`);
        const data = (await response.json()) as DateRangeResponse & { error?: string };
        if (!response.ok) {
          throw new Error(data.error || 'No fue posible cargar el rango temporal.');
        }
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
    const loadCatalogOptionGroups = async () => {
      if (!meta?.catalogFilters?.length) return;
      const nextOptions: Record<string, OptionItem[]> = {};

      for (const definition of meta.catalogFilters) {
        try {
          const response = await fetch('/api/catalog-options', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              departments: departmentMode === 'selected' ? selectedDepartments : [],
              catalogFilters,
              attributeKey: definition.key,
            }),
          });
          const data = (await response.json()) as { error?: string; options?: OptionItem[] };
          if (!response.ok) {
            throw new Error(data.error || `No fue posible cargar ${definition.label}.`);
          }
          nextOptions[definition.key] = data.options || [];
        } catch (error) {
          appendLog('ERROR', error instanceof Error ? error.message : `Error cargando ${definition.label}.`);
        }
      }

      setCatalogOptions(nextOptions);
    };

    if (step === 'advanced' && acceptedTerms) {
      void loadCatalogOptionGroups();
    }
  }, [acceptedTerms, catalogFilters, departmentMode, meta?.catalogFilters, selectedDepartments, step]);

  useEffect(() => {
    if (!isBusy || operationStartedAt === null) return undefined;

    const timer = window.setInterval(() => {
      setElapsedMs(Math.round(performance.now() - operationStartedAt));
    }, 250);

    return () => window.clearInterval(timer);
  }, [isBusy, operationStartedAt]);

  const validateCurrentConfiguration = () => {
    if (!acceptedTerms) {
      throw new Error('Debes aceptar el aviso legal antes de continuar.');
    }
    if (!datasetId) {
      throw new Error('Selecciona una variable para continuar.');
    }
    if (departmentMode === 'selected' && !selectedDepartments.length) {
      throw new Error('Selecciona al menos un departamento o usa todo el pais.');
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
    if (departmentMode !== 'selected' || !selectedDepartments.length) {
      setCoverageReports([]);
      return executionPayload;
    }

    setCoverageLoading(true);
    setActiveTask('Validando cobertura territorial...');
    appendLog('INFO', 'Validando cobertura territorial antes de descargar...');
    try {
      const response = await fetch('/api/coverage', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ datasetId, departments: selectedDepartments }),
      });
      const data = (await response.json()) as { error?: string; reports?: CoverageReport[] };
      if (!response.ok) {
        throw new Error(data.error || 'No fue posible validar la cobertura territorial.');
      }

      const reports = data.reports || [];
      setCoverageReports(reports);

      const discoveredDepartments = reports.flatMap((report) => [
        ...report.matched.map((item) => item.departamento),
        ...report.unmatched_discovered.map((item) => item.departamento),
      ]);
      const enhancedDepartments = Array.from(new Set([...selectedDepartments, ...discoveredDepartments].filter(Boolean)));
      const unmatchedRows = reports.reduce((sum, report) => sum + report.unmatched_rows, 0);

      if (unmatchedRows > 0) {
        appendLog(
          'INFO',
          `Cobertura con variantes nuevas: ${unmatchedRows.toLocaleString('es-CO')} filas potenciales se incluiran en la descarga.`
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
      const response = await fetch('/api/stations-helper', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          departments: departmentMode === 'selected' ? selectedDepartments : [],
          catalogFilters,
        }),
      });
      const data = (await response.json()) as { error?: string; stations?: StationHelperRow[] };
      if (!response.ok) {
        throw new Error(data.error || 'No fue posible cargar estaciones de apoyo.');
      }
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
      const response = await fetch('/api/preview', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(executionPayload),
      });
      const data = (await response.json()) as PreviewResponse & { error?: string };
      if (!response.ok) {
        throw new Error(data.error || 'No fue posible generar la vista previa.');
      }
      setPreview(data);
      setProgress(100);
      setActiveTask('Vista previa completada');
      appendLog(
        'SUCCESS',
        `Vista previa completada: ${data.rowCount.toLocaleString('es-CO')} filas, ${data.summary.stationCount} estaciones, ${data.processingMs} ms.`
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
      setProgress(2);
      setActiveTask('Validando cobertura territorial...');
      const startedAt = performance.now();
      const downloadPayload = await validateCoverageForDownload();

      setActiveTask('Preparando plan de exportacion...');
      appendLog('INFO', 'Construyendo plan de descarga paginada...');

      const planResponse = await fetch('/api/export-plan', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(downloadPayload),
      });
      const planData = (await planResponse.json()) as ExportPlanResponse & { error?: string };
      if (!planResponse.ok) {
        throw new Error(planData.error || 'No fue posible construir el plan de exportacion.');
      }
      if (!planData.rowCount) {
        throw new Error('La consulta no contiene datos. Ajusta los filtros antes de descargar.');
      }

      appendLog(
        'INFO',
        `Plan listo: ${planData.rowCount.toLocaleString('es-CO')} filas en ${planData.totalPages.toLocaleString('es-CO')} paginas.`
      );

      const totalPages = Math.max(planData.totalPages, 1);
      const totalParts = Math.max(1, Math.ceil(planData.rowCount / ARCHIVE_PART_ROW_LIMIT));
      const summaryAccumulator = createSummaryAccumulator();
      setTransferProgress({
        totalPages,
        completedPages: 0,
        totalRows: planData.rowCount,
        downloadedRows: 0,
        totalParts,
        completedParts: 0,
      });

      const [{ default: JSZip }, parquetDependencies] = await Promise.all([
        import('jszip'),
        selectedFormats.includes('parquet')
          ? Promise.all([
              import('apache-arrow'),
              import('parquet-wasm/esm').then(async (module) => {
                await module.default(parquetWasmUrl);
                return module;
              }),
            ])
          : Promise.resolve(null),
      ]);

      const zip = new JSZip();
      const dateColumn = selectedDataset?.dateColumn || 'fechaobservacion';
      const buildMemberName = (extension: string, partNumber: number) => {
        const suffix = totalParts > 1 && partNumber > 1 ? `_${partNumber}` : '';
        return `${planData.fileStem}${suffix}.${extension}`;
      };

      const writePartToArchive = async (rowsForPart: Record<string, unknown>[], partNumber: number) => {
        setActiveTask(`Empaquetando bloque ${partNumber} de ${totalParts}...`);

        if (selectedFormats.includes('csv')) {
          zip.file(buildMemberName('csv', partNumber), rowsToCsv(rowsForPart));
        }

        if (selectedFormats.includes('json')) {
          zip.file(buildMemberName('json', partNumber), JSON.stringify(rowsForPart, null, 2));
        }

        if (selectedFormats.includes('parquet')) {
          if (!parquetDependencies) {
            throw new Error('No fue posible inicializar la exportacion Parquet.');
          }

          const [arrowModule, parquetModule] = parquetDependencies;
          const arrowTable = arrowModule.tableFromJSON(rowsForPart);
          const wasmTable = parquetModule.Table.fromIPCStream(arrowModule.tableToIPC(arrowTable, 'stream'));
          const writerBuilder = new parquetModule.WriterPropertiesBuilder();
          const writerProperties = writerBuilder.setCompression(parquetModule.Compression.SNAPPY).build();

          try {
            zip.file(buildMemberName('parquet', partNumber), parquetModule.writeParquet(wasmTable, writerProperties));
          } finally {
            writerProperties.free();
            writerBuilder.free();
            wasmTable.free();
          }
        }
      };

      let partRows: Record<string, unknown>[] = [];
      let completedPages = 0;
      let downloadedRows = 0;
      let completedParts = 0;

      for (const planPage of planData.planPages) {
        for (let pageIndex = 0; pageIndex < planPage.pageCount; pageIndex += 1) {
          const offset = pageIndex * planData.pageSize;
          setActiveTask(`Descargando pagina ${completedPages + 1} de ${totalPages}...`);

          const pageResponse = await fetch('/api/export-page', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              datasetId,
              planIndex: planPage.planIndex,
              where: planPage.where,
              replacements: planData.replacements,
              offset,
              limit: planData.pageSize,
            }),
          });
          const pageData = (await pageResponse.json()) as ExportPageResponse & { error?: string };
          if (!pageResponse.ok) {
            throw new Error(pageData.error || 'No fue posible descargar una pagina de datos.');
          }

          partRows.push(...pageData.rows);
          updateSummaryAccumulator(summaryAccumulator, pageData.rows, dateColumn);
          completedPages += 1;
          downloadedRows += pageData.returnedRows;
          setTransferProgress({
            totalPages,
            completedPages,
            totalRows: planData.rowCount,
            downloadedRows,
            totalParts,
            completedParts,
          });
          setProgress(10 + Math.round((completedPages / totalPages) * 60));

          if (partRows.length >= ARCHIVE_PART_ROW_LIMIT) {
            completedParts += 1;
            await writePartToArchive(partRows, completedParts);
            partRows = [];
            setTransferProgress({
              totalPages,
              completedPages,
              totalRows: planData.rowCount,
              downloadedRows,
              totalParts,
              completedParts,
            });
          }
        }
      }

      if (partRows.length) {
        completedParts += 1;
        await writePartToArchive(partRows, completedParts);
        partRows = [];
        setTransferProgress({
          totalPages,
          completedPages,
          totalRows: planData.rowCount,
          downloadedRows,
          totalParts,
          completedParts,
        });
      }

      if (!downloadedRows || !completedParts) {
        throw new Error('La descarga se quedo sin datos utiles. No se genero ningun archivo.');
      }

      setActiveTask('Comprimiendo paquete ZIP...');
      appendLog('INFO', 'Comprimiendo archivos en ZIP...');
      setProgress(88);
      const zipBlob = await zip.generateAsync(
        { type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } },
        (metadata) => {
          setProgress(88 + Math.round(metadata.percent * 0.12));
        }
      );

      const summary = finalizeSummaryAccumulator(summaryAccumulator, downloadedRows);
      const archiveName = `${planData.fileStem}.zip`;
      const link = document.createElement('a');
      link.href = URL.createObjectURL(zipBlob);
      link.download = archiveName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(link.href);

      const totalMs = Math.round(performance.now() - startedAt);
      const metrics: DownloadMetrics = {
        fileName: archiveName,
        rowCount: summary.rowCount,
        stationCount: summary.stationCount,
        municipalityCount: summary.municipalityCount,
        departmentCount: summary.departmentCount,
        zoneCount: summary.zoneCount,
        processingMs: totalMs,
        sizeBytes: zipBlob.size,
        observedStart: summary.observedStart,
        observedEnd: summary.observedEnd,
        queryPlans: planData.queryPlans,
        stationPoolSize: planData.stationPoolSize,
        archivePartCount: completedParts,
        downloadedPages: completedPages,
      };

      setDownloadMetrics(metrics);
      saveHistory({
        timestamp: new Date().toLocaleString('es-CO'),
        variable: selectedDataset?.name || datasetId,
        format: `ZIP (${selectedFormats.join(', ').toUpperCase()})`,
        departments: departmentMode === 'selected' ? selectedDepartments : ['Todos'],
        catalogFilters,
        ...metrics,
      });

      setProgress(100);
      setActiveTask('Descarga completada');
      appendLog(
        'SUCCESS',
        `ZIP generado: ${archiveName}. ${metrics.rowCount.toLocaleString('es-CO')} filas, ${metrics.archivePartCount} parte(s) y ${formatDuration(metrics.processingMs)} de proceso.`
      );
    } catch (error) {
      setProgress(100);
      setActiveTask('Error en descarga');
      appendLog('ERROR', error instanceof Error ? error.message : 'Error durante la descarga.');
    } finally {
      setIsBusy(false);
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
      if (step === 'territory' && departmentMode === 'selected' && !selectedDepartments.length) {
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

  const runtimeRows =
    transferProgress?.downloadedRows ?? downloadMetrics?.rowCount ?? preview?.rowCount ?? 0;
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
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 min-h-[calc(100vh-7rem)]">
      <div className="xl:col-span-4 space-y-6">
        <div className="bg-card border border-border rounded-xl p-6 shadow-[0_0_40px_rgba(201,162,39,0.1)]">
          <h2 className="text-card-foreground text-xl font-bold mb-4">Asistente de extraccion</h2>
          <div className="space-y-3">
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
                  className={`w-full flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-all ${
                    isActive
                      ? 'border-accent bg-accent/10 text-card-foreground'
                      : isDone
                      ? 'border-success/30 bg-success/10 text-card-foreground'
                      : 'border-border bg-background text-muted-foreground hover:border-accent/40'
                  }`}
                >
                  <div className={`flex h-10 w-10 items-center justify-center rounded-full ${isDone ? 'bg-success/20' : 'bg-muted'}`}>
                    {isDone ? <CheckCircle2 className="h-5 w-5 text-success" /> : <Icon className="h-5 w-5 text-accent" />}
                  </div>
                  <div>
                    <p className="text-sm font-bold">{item.title}</p>
                    <p className="text-xs opacity-80">Paso {index + 1}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 shadow-[0_0_40px_rgba(201,162,39,0.1)]">
          <StepPanel
            step={step}
            meta={meta}
            datasetId={datasetId}
            selectedDataset={selectedDataset}
            acceptedTerms={acceptedTerms}
            onAcceptedTermsChange={setAcceptedTerms}
            departmentMode={departmentMode}
            setDepartmentMode={setDepartmentMode}
            selectedDepartments={selectedDepartments}
            onToggleDepartment={toggleDepartment}
            catalogFilters={catalogFilters}
            catalogOptions={catalogOptions}
            onToggleCatalogValue={toggleCatalogValue}
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

          <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-4">
            <MetricCard title="Variable" value={selectedDataset?.name || 'Sin seleccion'} icon={Database} />
            <MetricCard
              title="Filas"
              value={`${runtimeRows.toLocaleString('es-CO')} / ${runtimeTotalRows.toLocaleString('es-CO')}`}
              icon={FileSearch}
            />
            <MetricCard title="Paginas" value={runtimePages} icon={Layers} />
            <MetricCard title="Partes ZIP" value={runtimeParts} icon={FileArchive} />
            <MetricCard title="Estaciones" value={String(downloadMetrics?.stationCount || preview?.summary.stationCount || 0)} icon={MapPin} />
            <MetricCard title="Tiempo" value={formatDuration(runtimeElapsedMs)} icon={Clock3} />
            <MetricCard title="Peso" value={formatBytes(downloadMetrics?.sizeBytes || 0)} icon={Download} />
            <MetricCard title="Proceso" value={activeTask} icon={LoaderCircle} />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
              <SummaryRow label="Entrega" value="ZIP comprimido con particion automatica" />
              <SummaryRow label="Formatos" value={selectionSummary.formats.length ? selectionSummary.formats.join(', ').toUpperCase() : 'Sin seleccion'} />
              <SummaryRow label="Pool de estaciones" value={String(downloadMetrics?.stationPoolSize || preview?.stationPoolSize || 0)} />
              <SummaryRow label="Planes de consulta" value={String(downloadMetrics?.queryPlans || preview?.queryPlans || 0)} />
              <SummaryRow label="Partes esperadas" value={transferProgress ? String(transferProgress.totalParts) : String(downloadMetrics?.archivePartCount || 0)} />
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
                  <MetricCard title="Tiempo" value={`${preview.processingMs} ms`} icon={TimerReset} />
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
                <MetricCard title="Tiempo total" value={`${downloadMetrics.processingMs} ms`} icon={Clock3} />
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
  departmentMode,
  setDepartmentMode,
  selectedDepartments,
  onToggleDepartment,
  catalogFilters,
  catalogOptions,
  onToggleCatalogValue,
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
  departmentMode: DepartmentMode;
  setDepartmentMode: (value: DepartmentMode) => void;
  selectedDepartments: string[];
  onToggleDepartment: (department: string) => void;
  catalogFilters: Record<string, string[]>;
  catalogOptions: Record<string, OptionItem[]>;
  onToggleCatalogValue: (filterKey: string, value: string) => void;
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
        <div className="grid grid-cols-2 gap-3">
          <ChoiceCard active={departmentMode === 'all'} onClick={() => setDepartmentMode('all')} title="Todo el pais" description="No limitar por departamento" />
          <ChoiceCard active={departmentMode === 'selected'} onClick={() => setDepartmentMode('selected')} title="Departamentos puntuales" description="Replicar el paso territorial del terminal" />
        </div>
        {departmentMode === 'selected' ? (
          <>
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
          </>
        ) : (
          <div className="rounded-lg border border-border bg-background p-4 text-sm text-muted-foreground">
            La consulta se realizara sobre todos los departamentos disponibles en la fuente.
          </div>
        )}
      </Section>
    );
  }

  if (step === 'advanced') {
    return (
      <Section title="Personalizacion avanzada" icon={Filter}>
        <div className="rounded-lg border border-border bg-background p-4 text-sm text-muted-foreground">
          Este bloque replica la logica del terminal: zonas, categoria, tecnologia, estado, corriente, entidad,
          municipio de catalogo y carga manual de estaciones.
        </div>
        {(meta?.catalogFilters || []).map((definition) => (
          <div key={definition.key} className="space-y-2">
            <label className="text-sm font-semibold text-card-foreground">{definition.label}</label>
            <div className="max-h-40 overflow-y-auto rounded-lg border border-border bg-background p-3">
              {(catalogOptions[definition.key] || []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin opciones para los filtros actuales.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {(catalogOptions[definition.key] || []).map((option) => (
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
                      {option.value} ({option.total})
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-card-foreground">Codigos de estacion manuales</label>
          <textarea
            value={stationCodesText}
            onChange={(event) => onStationCodesTextChange(event.target.value)}
            rows={4}
            placeholder="Ej: 21205790, 29045180"
            className="w-full rounded-lg border border-border bg-input px-4 py-3 text-card-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
          />
          <div className="flex items-center justify-between gap-3">
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
        <div className="grid grid-cols-2 gap-3">
          <ChoiceCard active={timeMode === 'full'} onClick={() => setTimeMode('full')} title="Todo el historico" description="Usar todo el rango disponible" />
          <ChoiceCard active={timeMode === 'custom'} onClick={() => setTimeMode('custom')} title="Rango personalizado" description="Definir fechas exactas" />
        </div>
        <div className="rounded-lg border border-border bg-background p-4 text-sm text-muted-foreground">
          Rango detectado: {dateRange?.startDate || 'N/D'} {'->'} {dateRange?.endDate || 'N/D'} ({dateRange?.startYear || 'N/D'} -{' '}
          {dateRange?.endYear || 'N/D'})
        </div>
        {timeMode === 'custom' ? (
          <div className="grid grid-cols-2 gap-4">
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
        <div className="grid grid-cols-3 gap-3">
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
                Filas cubiertas: {report.matched_rows.toLocaleString('es-CO')} · Filas no cubiertas:{' '}
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
        active ? 'border-accent bg-accent/10 text-card-foreground' : 'border-border bg-background text-muted-foreground hover:border-accent/40'
      }`}
    >
      <p className="font-bold text-sm">{title}</p>
      <p className="text-xs mt-1">{description}</p>
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
    <div className="flex items-start justify-between gap-3 border-b border-border/60 pb-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-semibold text-card-foreground">{value}</span>
    </div>
  );
}

function MetricCard({ title, value, icon: Icon }: { title: string; value: string; icon: React.ElementType }) {
  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-muted-foreground">{title}</span>
        <Icon className="h-4 w-4 text-accent" />
      </div>
      <p className="text-sm font-bold text-card-foreground break-words">{value}</p>
    </div>
  );
}

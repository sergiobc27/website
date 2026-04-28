import { useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Database,
  Download,
  FileSearch,
  Filter,
  Layers,
  MapPin,
  Rocket,
  Search,
  ShieldCheck,
  TimerReset,
} from 'lucide-react';
import { EmptyState } from './EmptyState';

const HISTORY_KEY = 'ideam-history';

type StepId = 'consent' | 'variable' | 'territory' | 'advanced' | 'time' | 'execute';
type FormatType = 'csv' | 'json';
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
  maxExportRows: number;
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

export function DataExtractor() {
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
  const [format, setFormat] = useState<FormatType>('csv');
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [downloadMetrics, setDownloadMetrics] = useState<DownloadMetrics | null>(null);
  const [logs, setLogs] = useState<Array<{ type: LogLevel; message: string }>>([]);
  const [isBusy, setIsBusy] = useState(false);
  const [progress, setProgress] = useState(0);

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
      format,
    };
  }, [catalogFilters, datasetId, departmentMode, endDate, format, selectedDepartments, startDate, stationCodesText]);

  const selectionSummary = useMemo(() => {
    const advancedSelections = (meta?.catalogFilters || [])
      .map((item) => ({ label: item.label, values: catalogFilters[item.key] || [] }))
      .filter((item) => item.values.length);
    return {
      departments: departmentMode === 'all' ? 'Todos los departamentos' : selectedDepartments.join(', ') || 'Sin seleccion',
      advancedSelections,
      stationCodes: parseStationCodes(stationCodesText),
    };
  }, [catalogFilters, departmentMode, meta?.catalogFilters, selectedDepartments, stationCodesText]);

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

    if (step === 'advanced') {
      void loadCatalogOptionGroups();
    }
  }, [catalogFilters, departmentMode, meta?.catalogFilters, selectedDepartments, step]);

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

  const runCoverage = async () => {
    try {
      validateCurrentConfiguration();
      if (departmentMode !== 'selected' || !selectedDepartments.length) {
        throw new Error('La validacion territorial requiere al menos un departamento seleccionado.');
      }
      setCoverageLoading(true);
      appendLog('INFO', 'Validando cobertura territorial del mapeo...');
      const response = await fetch('/api/coverage', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ datasetId, departments: selectedDepartments }),
      });
      const data = (await response.json()) as { error?: string; reports?: CoverageReport[] };
      if (!response.ok) {
        throw new Error(data.error || 'No fue posible validar la cobertura territorial.');
      }
      setCoverageReports(data.reports || []);
      appendLog('SUCCESS', 'Cobertura territorial validada.');
    } catch (error) {
      appendLog('ERROR', error instanceof Error ? error.message : 'Error validando cobertura.');
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
      setProgress(25);
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
      appendLog(
        'SUCCESS',
        `Vista previa completada: ${data.rowCount.toLocaleString('es-CO')} filas, ${data.summary.stationCount} estaciones, ${data.processingMs} ms.`
      );
    } catch (error) {
      setProgress(100);
      appendLog('ERROR', error instanceof Error ? error.message : 'Error en la vista previa.');
    } finally {
      setIsBusy(false);
    }
  };

  const runDownload = async () => {
    try {
      validateCurrentConfiguration();
      setIsBusy(true);
      setProgress(35);
      appendLog('INFO', `Iniciando descarga ${format.toUpperCase()}...`);
      const startedAt = performance.now();
      const response = await fetch('/api/export', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(executionPayload),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'No fue posible completar la descarga.');
      }

      const blob = await response.blob();
      const totalMs = Math.round(performance.now() - startedAt);
      const fileName = response.headers.get('x-export-name') || 'ideam-export.csv';
      const metrics: DownloadMetrics = {
        fileName,
        rowCount: Number(response.headers.get('x-row-count') || '0'),
        stationCount: Number(response.headers.get('x-station-count') || '0'),
        municipalityCount: Number(response.headers.get('x-municipality-count') || '0'),
        departmentCount: Number(response.headers.get('x-department-count') || '0'),
        zoneCount: Number(response.headers.get('x-zone-count') || '0'),
        processingMs: Number(response.headers.get('x-processing-ms') || String(totalMs)),
        sizeBytes: Number(response.headers.get('x-size-bytes') || String(blob.size)),
        observedStart: response.headers.get('x-observed-start') || '',
        observedEnd: response.headers.get('x-observed-end') || '',
        queryPlans: Number(response.headers.get('x-query-plans') || '0'),
        stationPoolSize: Number(response.headers.get('x-station-pool-size') || '0'),
      };

      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(link.href);

      setDownloadMetrics(metrics);
      saveHistory({
        timestamp: new Date().toLocaleString('es-CO'),
        variable: selectedDataset?.name || datasetId,
        format,
        departments: departmentMode === 'selected' ? selectedDepartments : ['Todos'],
        catalogFilters,
        ...metrics,
      });

      setProgress(100);
      appendLog(
        'SUCCESS',
        `Descarga completada: ${metrics.fileName}. ${metrics.rowCount.toLocaleString('es-CO')} filas en ${metrics.processingMs} ms.`
      );
    } catch (error) {
      setProgress(100);
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

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 min-h-[calc(100vh-7rem)]">
      <div className="xl:col-span-4 space-y-6">
        <div className="bg-card border border-border rounded-xl p-6 shadow-[0_0_40px_rgba(201,162,39,0.1)]">
          <h2 className="text-card-foreground text-xl font-bold mb-4">Asistente de Extraccion</h2>
          <div className="space-y-3">
            {steps.map((item, index) => {
              const Icon = item.icon;
              const isActive = step === item.id;
              const isDone = selectedStepIndex > index;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setStep(item.id)}
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
            format={format}
            onFormatChange={setFormat}
            onDatasetChange={setDatasetId}
            selectionSummary={selectionSummary}
            coverageReports={coverageReports}
            coverageLoading={coverageLoading}
            onRunCoverage={runCoverage}
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

          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <MetricCard title="Variable" value={selectedDataset?.name || 'Sin seleccion'} icon={Database} />
            <MetricCard title="Filas estimadas" value={preview?.rowCount?.toLocaleString('es-CO') || '0'} icon={FileSearch} />
            <MetricCard title="Estaciones" value={String(downloadMetrics?.stationCount || preview?.summary.stationCount || 0)} icon={MapPin} />
            <MetricCard title="Tiempo" value={`${downloadMetrics?.processingMs || preview?.processingMs || 0} ms`} icon={Clock3} />
            <MetricCard title="Peso" value={formatBytes(downloadMetrics?.sizeBytes || 0)} icon={Download} />
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
            <h3 className="text-card-foreground font-bold mb-4">Impacto para el usuario</h3>
            <div className="space-y-3 text-sm">
              <SummaryRow label="Formato elegido" value={format.toUpperCase()} />
              <SummaryRow label="Pool de estaciones" value={String(downloadMetrics?.stationPoolSize || preview?.stationPoolSize || 0)} />
              <SummaryRow label="Planes de consulta" value={String(downloadMetrics?.queryPlans || preview?.queryPlans || 0)} />
              <SummaryRow label="Municipios cubiertos" value={String(downloadMetrics?.municipalityCount || preview?.summary.municipalityCount || 0)} />
              <SummaryRow label="Zonas detectadas" value={String(downloadMetrics?.zoneCount || preview?.summary.zoneCount || 0)} />
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
                <MetricCard title="Tiempo" value={`${downloadMetrics.processingMs} ms`} icon={Clock3} />
                <MetricCard title="Peso" value={formatBytes(downloadMetrics.sizeBytes)} icon={Download} />
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
  format,
  onFormatChange,
  onDatasetChange,
  selectionSummary,
  coverageReports,
  coverageLoading,
  onRunCoverage,
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
  format: FormatType;
  onFormatChange: (value: FormatType) => void;
  onDatasetChange: (value: string) => void;
  selectionSummary: {
    departments: string;
    advancedSelections: Array<{ label: string; values: string[] }>;
    stationCodes: string[];
  };
  coverageReports: CoverageReport[];
  coverageLoading: boolean;
  onRunCoverage: () => void;
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
            Acepto los terminos y entiendo que la plataforma automatiza descargas de datos hidricos para uso tecnico,
            academico o investigativo.
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
          <ChoiceCard
            active={departmentMode === 'all'}
            onClick={() => setDepartmentMode('all')}
            title="Todo el pais"
            description="No limitar por departamento"
          />
          <ChoiceCard
            active={departmentMode === 'selected'}
            onClick={() => setDepartmentMode('selected')}
            title="Departamentos puntuales"
            description="Replicar el paso de seleccion territorial"
          />
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

      <div className="flex gap-2">
        {(['csv', 'json'] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => onFormatChange(item)}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
              format === item
                ? 'bg-accent text-accent-foreground shadow-[0_0_20px] shadow-accent/40'
                : 'bg-muted text-muted-foreground hover:bg-primary/20 hover:text-card-foreground'
            }`}
          >
            {item.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <button
          type="button"
          onClick={onRunCoverage}
          disabled={coverageLoading}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-3 text-sm font-semibold text-card-foreground hover:border-accent/40 disabled:opacity-50"
        >
          <ShieldCheck className="h-4 w-4" />
          {coverageLoading ? 'Validando...' : 'Cobertura'}
        </button>
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
          disabled={isBusy}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-primary to-accent px-4 py-3 text-sm font-semibold text-primary-foreground hover:shadow-[0_0_24px] hover:shadow-accent/40 disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          Descargar
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

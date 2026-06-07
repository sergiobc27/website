export type OutputFormat = 'csv' | 'json' | 'parquet';

export interface DatasetMeta {
  id: string;
  name: string;
  category: string;
  dateColumn?: string;
}

export interface CatalogFilterDefinition {
  key: string;
  label: string;
  column: string;
  labelColumn?: string;
}

export interface DataFreshness {
  /** Fecha de la observación más reciente cargada en el espejo (ISO 8601). */
  latestObservation: string | null;
  /** Momento de la última sincronización exitosa con datos.gov.co (ISO 8601). */
  lastSync: string | null;
}

export interface MetaResponse {
  datasets: DatasetMeta[];
  departments: string[];
  previewLimit: number;
  exportPageSize: number;
  maxExportRows: number | null;
  catalogFilters: CatalogFilterDefinition[];
  dataFreshness?: DataFreshness;
}

export type AnalyticsInterval = 'day' | 'month' | 'year';
export type AnalyticsMetric = 'avg' | 'sum' | 'min' | 'max' | 'count';

export interface AnalyticsTimeseriesPoint {
  bucket: string;
  value: number | null;
  n: number;
}

export interface AnalyticsTimeseriesResponse {
  datasetId: string;
  interval: AnalyticsInterval;
  metric: AnalyticsMetric;
  points: AnalyticsTimeseriesPoint[];
}

export interface AnalyticsRegionRow {
  department: string;
  rowCount: number;
  mean: number | null;
  stationCount: number;
}

export interface AnalyticsByRegionResponse {
  datasetId: string;
  regions: AnalyticsRegionRow[];
}

export interface AnalyticsClimatologyMonth {
  month: number;
  mean: number | null;
  min: number | null;
  max: number | null;
  n: number;
}

export interface AnalyticsClimatologyResponse {
  datasetId: string;
  months: AnalyticsClimatologyMonth[];
}

export interface AnalyticsDatasetOverview {
  id: string;
  name: string;
  category: string;
  rowCount: number;
  stationCount: number;
  firstObservation: string | null;
  lastObservation: string | null;
}

export interface AnalyticsDatasetsOverviewResponse {
  datasets: AnalyticsDatasetOverview[];
}

export interface DateRangeResponse {
  datasetId: string;
  startDate: string | null;
  endDate: string | null;
  startYear: number | null;
  endYear: number | null;
}

export interface OptionItem {
  value: string;
  label?: string;
  total: number;
}

export type CatalogBundleRow = Record<string, string | number>;

export interface StationHelperRow {
  code: string;
  name: string;
  department: string;
  municipality: string;
  zone: string;
  entity: string;
}

export interface CoverageReport {
  department: string;
  configured_variants: string[];
  matched: Array<{ departamento: string; normalized: string; total: number }>;
  matched_rows: number;
  unmatched_rows: number;
  unmatched_discovered: Array<{ departamento: string; normalized: string; total: number }>;
}

export interface PreviewResponse {
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

export interface ExportJobPart {
  index: number;
  fileName: string;
  rowCount: number;
  sizeBytes: number;
  formats: string[];
  downloadPath: string;
  expiresAt?: string;
}

export interface DownloadMetrics {
  fileName: string;
  rowCount: number;
  noData?: boolean;
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

export interface ExportJobStatusResponse {
  jobId: string;
  status: 'queued' | 'planning' | 'processing' | 'retrying' | 'completed' | 'failed';
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  updatedAt: string;
  datasetId: string;
  datasetName: string;
  fileStem: string | null;
  warnings: string[];
  error: string | null;
  retryCount: number;
  retryLimit: number;
  lastErrorAt: string | null;
  selectedFormats: string[];
  effectiveFormats: string[];
  rowCount: number;
  totalPages: number;
  completedPages: number;
  processedRows: number;
  currentPage: number;
  pageSize: number | null;
  currentStage: string;
  progressPercent: number;
  elapsedSeconds: number;
  rowsPerSecond: number;
  estimatedRemainingSeconds: number | null;
  queryPlans: number;
  stationPoolSize: number;
  parts: ExportJobPart[];
  metrics: DownloadMetrics | null;
}

export interface ExportPlanPage {
  planIndex: number;
  where: string | null;
  rowCount: number;
  pageCount: number;
}

export interface ExportPlanResponse {
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

export interface ExportPageResponse {
  datasetId: string;
  planIndex: number;
  offset: number;
  returnedRows: number;
  rows: Record<string, unknown>[];
}

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

export interface AnalyticsStationRow {
  code: string;
  municipality: string | null;
  department: string | null;
  rowCount: number;
  mean: number | null;
  firstObservation: string | null;
  lastObservation: string | null;
}

export interface AnalyticsByStationResponse {
  datasetId: string;
  stations: AnalyticsStationRow[];
}

export interface ReturnPeriodQuantile {
  returnPeriod: number;
  value: number;
}

export interface GoodnessOfFit {
  test: string;
  statistic: number;
  critical: number;
  alpha: number;
  passes: boolean;
}

export interface ReturnPeriodsResponse {
  datasetId: string;
  stationYears: Array<{ year: number; maximum: number; days: number }>;
  n: number;
  mean?: number;
  std?: number;
  gumbel: { mu: number; beta: number } | null;
  quantiles: ReturnPeriodQuantile[];
  empirical: ReturnPeriodQuantile[];
  goodnessOfFit?: GoodnessOfFit | null;
  warnings: string[];
  method?: string;
}

export interface SpiPoint {
  month: string;
  precipitation: number;
  spi: number | null; // null cuando el mes tiene <3 años de historia (no calculable)
  category: string;
}

export interface SpiResponse {
  scale: number;
  points: SpiPoint[];
  latest: SpiPoint | null;
  spiCeiling?: number | null;
  warnings: string[];
  method?: string;
}

export interface HistogramResponse {
  dryDays: number;
  wetDays: number;
  noDataDays?: number;
  maxDaily: number;
  bins: Array<{ from: number; to: number; count: number }>;
}

export interface IdfPoint {
  durMin: number;
  depthMm: number;
  intensityMmH: number;
}

export interface IdfCurve {
  returnPeriod: number;
  points: IdfPoint[];
}

export interface IdfResponse {
  available: boolean;
  message?: string;
  datasetId?: string;
  nYears?: number;
  durations: number[];
  returnPeriods: number[];
  curves: IdfCurve[];
  equation: { K: number; m: number; n: number; r2: number; r2Space?: string } | null;
  warnings: string[];
  method?: string;
}

export interface IdfStation {
  codigo: string;
  nombre: string;
  municipio: string;
  departamento: string;
  aniosValidos: number;
}

export interface IdfStationsResponse {
  stations: IdfStation[];
  count: number;
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

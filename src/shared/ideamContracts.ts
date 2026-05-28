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

export interface MetaResponse {
  datasets: DatasetMeta[];
  departments: string[];
  previewLimit: number;
  exportPageSize: number;
  maxExportRows: number | null;
  catalogFilters: CatalogFilterDefinition[];
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

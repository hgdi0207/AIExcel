export type PivotValueConfig = {
  field: string;
  aggregation: 'sum' | 'avg' | 'count' | 'min' | 'max' | string;
};

export type PivotFilterConfig = {
  field: string;
  operator: string;
  value: string;
};

export type PivotConfig = {
  rows?: string[];
  columns?: string[];
  values?: PivotValueConfig[];
  filters?: PivotFilterConfig[];
};

export type WorkbookSource = {
  fileName: string;
  mimeType: string;
  localFilePath?: string;
};

export type PivotExportMode = 'node_summary' | 'java_native';

export type PivotExportInput = {
  jobId: string;
  userId: string;
  workbook: WorkbookSource;
  sheetName: string;
  config: PivotConfig;
};

export type PivotExportMetadata = {
  exportFileName: string;
  exportFileUrl: string;
  exportFileSizeBytes: number;
  sheetName: string;
};

export type PivotResolvedExport = PivotExportMetadata & {
  exportFilePath: string;
};

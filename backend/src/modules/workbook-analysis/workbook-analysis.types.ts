export type WorkbookAnalysisSnapshot = {
  workbook: WorkbookAnalysisWorkbookSummary;
  sheets: WorkbookAnalysisSheetProfile[];
};

export type WorkbookAnalysisWorkbookSummary = {
  sheetCount: number;
  rowCount: number;
  columnCount: number;
  summaryMd: string;
  summaryJson: Record<string, unknown>;
  candidateDatasets: WorkbookAnalysisCandidateDataset[];
  workbookQuality: WorkbookAnalysisWorkbookQuality;
};

export type WorkbookAnalysisWorkbookQuality = {
  hasMergedLayoutRisk: boolean;
  hasEmptySummarySheet: boolean;
  warnings: string[];
};

export type WorkbookAnalysisCandidateDataset = {
  sheetName: string;
  regionId: string;
  confidence: number;
};

export type WorkbookAnalysisSheetProfile = {
  id: string;
  sheetName: string;
  sheetIndex: number;
  headers: string[];
  columnTypes: string[];
  formulaColumns: string[];
  sampleRows: string[][];
  dataRows: string[][];
  rowCount: number;
  columnCount: number;
  tableRegions: WorkbookAnalysisTableRegion[];
  fieldProfiles: WorkbookAnalysisFieldProfile[];
  qualityProfile: WorkbookAnalysisQualityProfile;
  summaryMd: string;
  confidence: number;
  isPrimary: boolean;
};

export type WorkbookAnalysisTableRegion = {
  regionId: string;
  range: string;
  headerRowIndex: number;
  dataStartRowIndex: number;
  rowCount: number;
  columnCount: number;
  confidence: number;
  isPrimary: boolean;
};

export type WorkbookAnalysisFieldProfile = {
  fieldName: string;
  normalizedFieldName: string;
  dataType: 'string' | 'number' | 'date' | 'boolean' | 'mixed';
  semanticRole: 'dimension' | 'metric' | 'time' | 'id' | 'category' | 'text_note';
  nonNullRatio: number;
  distinctCount: number;
  exampleValues: string[];
  min?: number | null;
  max?: number | null;
  mean?: number | null;
  currencyHint?: string | null;
};

export type WorkbookAnalysisQualityProfile = {
  blankRowRatio: number;
  duplicateRowCount: number;
  invalidDateColumns: string[];
  numericPollutionColumns: string[];
  warnings: string[];
};

export type AnalysisFactPack = {
  totals: Record<string, number>;
  trends: Array<{
    metric: string;
    grain: string;
    points: Array<{ period: string; value: number }>;
  }>;
  rankings: Array<{
    dimension: string;
    items: Array<{ label: string; value: number }>;
  }>;
  anomalies: Array<{
    metric: string;
    label: string;
    actual: number;
    deviationPct?: number | null;
    reason?: string | null;
  }>;
};

export type AnalysisQualityWarning = {
  type: 'quality' | 'coverage' | 'confidence';
  level: 'info' | 'warning' | 'critical';
  message: string;
  sheetName?: string | null;
  fieldName?: string | null;
};

export type AnalysisContext = {
  dataset: {
    sheetName: string;
    regionId: string;
    range: string;
    headers: string[];
    rowCount: number;
    columnCount: number;
    timeField?: string | null;
    metricField?: string | null;
    dimensionField?: string | null;
  };
  summaryMd: string;
  factPack: AnalysisFactPack;
  qualityWarnings: AnalysisQualityWarning[];
  followupSuggestions: string[];
  confidenceScore: number;
};

export type ChartContext = {
  title: string;
  chartType: 'bar' | 'line' | 'pie' | 'scatter';
  xAxis: string;
  yAxis: string;
  config: {
    xAxisField: string;
    yAxisField: string;
    sourceSheet: string;
  };
  chartData: {
    sourceKind: 'trend' | 'ranking' | 'scatter' | 'raw';
    labels?: string[];
    values?: number[];
    points?: Array<{
      label: string;
      value?: number;
      x?: number;
      y?: number;
    }>;
  };
  sourceSummary: string;
};

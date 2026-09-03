export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  error?: {
    code: string;
    message: string;
  };
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  plan: string;
  locale: string;
}

export interface WorkbookItem {
  id: string;
  userId: string;
  fileName: string;
  status: string;
  fileType: string;
  fileSizeBytes: number;
  sheetCount: number;
  rowCount: number;
  columnCount: number;
  summaryMd: string;
  uploadedAt: string;
}

export interface WorkbookSheetPreview {
  id: string;
  sheetName: string;
  sheetIndex: number;
  headers: string[];
  columnTypes?: string[];
  formulaColumns?: string[];
  sampleRows: string[][];
  tableRegions?: Array<Record<string, unknown>>;
  fieldProfiles?: Array<Record<string, unknown>>;
  qualityProfile?: Record<string, unknown>;
  rowCount: number;
  columnCount: number;
}

export interface WorkbookPreview {
  workbook: WorkbookItem;
  sheets: WorkbookSheetPreview[];
}

export interface AssistantThread {
  id: string;
  userId: string;
  title: string;
  workbookId?: string;
  updatedAt: string;
}

export interface AssistantMessage {
  id: string;
  threadId: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  aiRequestId?: string;
}

export interface JobPayload {
  id: string;
  status: string;
  progress?: number;
  creditsConsumed?: number;
}

export interface ToolJobDetail {
  job: {
    id: string;
    status: string;
    progress: number;
    errorMessage?: string | null;
  };
  result: unknown;
}

export interface AnalysisInsight {
  type: 'trend' | 'anomaly' | 'quality' | 'recommendation';
  title: string;
  description: string;
}

export interface AnalysisResult {
  summaryMd?: string | null;
  insights?: AnalysisInsight[] | null;
  facts?: Record<string, unknown> | null;
  dataset?: Record<string, unknown> | null;
  qualityWarnings?: Array<Record<string, unknown>> | null;
  confidenceScore?: number | null;
  followupSuggestions?: string[] | null;
}

export interface ChartResult {
  title?: string | null;
  xAxis?: string | null;
  yAxis?: string | null;
  chartType?: 'bar' | 'line' | 'pie' | 'scatter' | null;
  config?: {
    xAxisField?: string | null;
    yAxisField?: string | null;
    sourceSheet?: string | null;
  } | null;
  chartData?: {
    sourceKind?: 'trend' | 'ranking' | 'scatter' | 'raw';
    labels?: string[];
    values?: number[];
    points?: Array<{
      label: string;
      value?: number;
      x?: number;
      y?: number;
    }>;
  } | null;
  sourceSummary?: string | null;
}

export interface UsageMetric {
  metricType: string;
  usedCount: number;
}

export interface UsageSummary {
  plan: string;
  credits: {
    total: number;
    used: number;
    remaining: number;
  };
  metrics: UsageMetric[];
}

export interface BillingSummary extends UsageSummary {
  subscriptionStatus: string;
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
  cancelAtPeriodEnd?: boolean;
  planCode?: string | null;
  amountCents?: number | null;
  interval?: string | null;
  billingPortalAvailable?: boolean;
}

export interface BillingCheckoutResult {
  checkoutUrl: string;
  sessionId?: string;
  planCode?: string;
}

export interface BillingPortalResult {
  portalUrl: string;
}

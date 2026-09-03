import type { ToolType } from '@prisma/client';
import type { AnalysisContext, ChartContext } from '../workbook-analysis/workbook-analysis.types';

export type AiTaskModelTier = 'fast' | 'default' | 'complex';

export type WorkbookContext = {
  workbookId: string;
  fileName: string;
  mimeType: string;
  summaryMd: string;
  rowCount: number;
  sheetCount: number;
  localFilePath?: string;
};

export type WorkbookSheetContext = {
  sheetName: string;
  headers: string[];
  sampleRows: string[][];
  rowCount: number;
  columnCount: number;
};

export type AssistantGenerationInput = {
  userId: string;
  question: string;
  workbook?: WorkbookContext;
  threadTitle?: string;
  recentMessages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
  }>;
};

export type PivotGenerationInput = {
  userId: string;
  prompt: string;
  workbook: WorkbookContext;
  sheet: WorkbookSheetContext;
};

export type AnalysisGenerationInput = {
  userId: string;
  prompt: string;
  workbook: WorkbookContext;
  sheets: WorkbookSheetContext[];
  complexity: 'normal' | 'complex';
  analysisContext: AnalysisContext;
};

export type ChartGenerationInput = {
  userId: string;
  prompt: string;
  workbook: WorkbookContext;
  sheet: WorkbookSheetContext;
  preferredChartType: 'bar' | 'line' | 'pie' | 'scatter';
  chartContext: ChartContext;
};

export type ReportGenerationInput = {
  userId: string;
  prompt: string;
  workbook: WorkbookContext;
  sheets: WorkbookSheetContext[];
  format: 'md' | 'docx' | 'pdf';
  complexity: 'normal' | 'complex';
};

export type AiTaskSuccess<TResult> = {
  aiRequestId: string;
  output: TResult;
};

export class AiExecutionError extends Error {
  constructor(
    message: string,
    public readonly aiRequestId?: string,
  ) {
    super(message);
    this.name = 'AiExecutionError';
  }
}

export type AiRequestPayload = {
  userId: string;
  toolType: ToolType;
  tier: AiTaskModelTier;
  promptVersion: string;
  prompt: string;
  developerPrompt?: string;
  workbook?: WorkbookContext;
  metadata?: Record<string, unknown>;
};

export type UsageToolType =
  | 'spreadsheet_assistant'
  | 'file_upload'
  | 'pivot_builder'
  | 'charts'
  | 'data_analysis'
  | 'reports';

export interface UsageEventRecord {
  id: string;
  userId: string;
  toolType: UsageToolType;
  creditDelta: number;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

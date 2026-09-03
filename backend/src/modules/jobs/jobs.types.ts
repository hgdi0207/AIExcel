export type JobKind = 'analysis' | 'report' | 'chart' | 'pivot';
export type JobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'canceled';

export type JobRunInput<TPayload extends Record<string, unknown>, TResult> = {
  job: JobRecord<TPayload, TResult>;
};

export interface JobRecord<TPayload = Record<string, unknown>, TResult = unknown> {
  id: string;
  userId: string;
  kind: JobKind;
  status: JobStatus;
  progress: number;
  title: string;
  payload: TPayload;
  result: TResult | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

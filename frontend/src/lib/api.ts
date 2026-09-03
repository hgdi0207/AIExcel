import type {
  ApiEnvelope,
  AssistantMessage,
  AssistantThread,
  AuthUser,
  BillingSummary,
  BillingCheckoutResult,
  BillingPortalResult,
  ToolJobDetail,
  UsageSummary,
  WorkbookItem,
  WorkbookPreview,
} from '@/lib/types';

type FetchOptions = RequestInit & {
  bodyJson?: unknown;
};

async function parseJson<T>(response: Response) {
  const payload = (await response.json()) as ApiEnvelope<T>;
  if (!response.ok || !payload.success) {
    throw new Error(payload.error?.message ?? 'Request failed');
  }
  return payload.data;
}

async function refreshSession() {
  const response = await fetch('/api/auth/refresh', {
    method: 'POST',
    credentials: 'include',
    cache: 'no-store',
  });

  return response.ok;
}

async function fetchWithSessionRefresh(path: string, options: FetchOptions = {}) {
  const headers = new Headers(options.headers);
  if (options.bodyJson !== undefined) {
    headers.set('Content-Type', 'application/json');
  }

  const requestInit: RequestInit = {
    ...options,
    headers,
    body: options.bodyJson !== undefined ? JSON.stringify(options.bodyJson) : options.body,
    credentials: 'include',
    cache: 'no-store',
  };

  const response = await fetch(path, requestInit);
  if (response.status !== 401 || path === '/api/auth/refresh' || path === '/api/auth/logout') {
    return response;
  }

  const refreshed = await refreshSession();
  if (!refreshed) {
    return response;
  }

  return fetch(path, requestInit);
}

export async function apiFetch<T>(path: string, options: FetchOptions = {}) {
  const response = await fetchWithSessionRefresh(path, options);
  return parseJson<T>(response);
}

export function uploadWorkbook(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  return apiFetch<{ workbook: WorkbookItem }>('/api/files/upload', {
    method: 'POST',
    body: formData,
  });
}

export function getCurrentUser() {
  return apiFetch<{ user: AuthUser }>('/api/auth/me');
}

export function getFiles() {
  return apiFetch<{ items: WorkbookItem[] }>('/api/files');
}

export function getWorkbookPreview(workbookId: string) {
  return apiFetch<WorkbookPreview>(`/api/files/${workbookId}/preview`);
}

export function getThreads(workbookId?: string) {
  const query = workbookId ? `?workbookId=${encodeURIComponent(workbookId)}` : '';
  return apiFetch<{ items: AssistantThread[] }>(`/api/assistant/threads${query}`);
}

export function createThread(input: { title?: string; workbookId?: string }) {
  return apiFetch<{ thread: AssistantThread }>('/api/assistant/threads', {
    method: 'POST',
    bodyJson: input,
  });
}

export function getMessages(threadId: string) {
  return apiFetch<{ thread: AssistantThread; messages: AssistantMessage[] }>(
    `/api/assistant/threads/${threadId}/messages`,
  );
}

export async function streamAssistantReply(
  threadId: string,
  content: string,
  handlers: {
    onDelta: (delta: string) => void;
    onComplete: (payload: Record<string, unknown>) => void;
  },
) {
  const response = await fetchWithSessionRefresh(
    `/api/assistant/threads/${threadId}/messages/stream`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content }),
    },
  );

  if (!response.ok || !response.body) {
    throw new Error('Streaming request failed');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n\n');
    buffer = parts.pop() ?? '';

    for (const block of parts) {
      const eventLine = block
        .split('\n')
        .find((line) => line.startsWith('event:'))
        ?.replace('event:', '')
        .trim();
      const dataLine = block
        .split('\n')
        .find((line) => line.startsWith('data:'))
        ?.replace('data:', '')
        .trim();

      if (!eventLine || !dataLine) {
        continue;
      }

      const payload = JSON.parse(dataLine) as Record<string, unknown>;
      if (eventLine === 'message.delta') {
        handlers.onDelta(String(payload.delta ?? ''));
      }
      if (eventLine === 'message.complete') {
        handlers.onComplete(payload);
      }
    }
  }
}

export function createToolJob<TInput extends Record<string, unknown>>(
  path: string,
  input: TInput,
) {
  return apiFetch<{ job: JobSummary; polling: boolean }>(path, {
    method: 'POST',
    bodyJson: input,
  });
}

type JobSummary = {
  id: string;
  status: string;
  creditsConsumed: number;
};

export function getToolJob(path: string, jobId: string) {
  return apiFetch<ToolJobDetail>(`${path}/${jobId}`);
}

export function getUsageSummary() {
  return apiFetch<UsageSummary>('/api/usage/summary');
}

export function getUsageHistory() {
  return apiFetch<{ items: Array<Record<string, unknown>> }>('/api/usage/history');
}

export function getBillingSummary() {
  return apiFetch<BillingSummary>('/api/billing/summary');
}

export function createBillingCheckout(planCode: string) {
  return apiFetch<BillingCheckoutResult>('/api/billing/checkout', {
    method: 'POST',
    bodyJson: { planCode },
  });
}

export function createBillingPortalSession() {
  return apiFetch<BillingPortalResult>('/api/billing/portal', {
    method: 'POST',
  });
}

export function getDashboardSummary() {
  return apiFetch<{
    user: { name: string; plan: string };
    credits: { total: number; used: number; remaining: number };
    recentWorkbooks: WorkbookItem[];
    recentJobs: Array<Record<string, unknown>>;
  }>('/api/dashboard/summary');
}

export async function waitForJob(path: string, jobId: string) {
  let attempts = 0;
  while (attempts < 40) {
    const detail = await getToolJob(path, jobId);
    if (detail.job.status === 'failed') {
      const resultObject =
        typeof detail.result === 'object' && detail.result !== null
          ? (detail.result as Record<string, unknown>)
          : null;
      const errorMessage =
        detail.job.errorMessage ||
        (typeof resultObject?.exportErrorMessage === 'string'
          ? resultObject.exportErrorMessage
          : null) ||
        'Job execution failed';
      throw new Error(errorMessage);
    }
    if (detail.job.status === 'completed') {
      return detail;
    }
    attempts += 1;
    await new Promise((resolve) => setTimeout(resolve, 800));
  }

  throw new Error('Timed out waiting for job result');
}

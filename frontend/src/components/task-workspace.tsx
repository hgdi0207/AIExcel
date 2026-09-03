'use client';

import { useEffect, useState } from 'react';
import { createToolJob, getWorkbookPreview, waitForJob } from '@/lib/api';
import type { AnalysisResult, ChartResult, WorkbookPreview } from '@/lib/types';
import { ChartPreview } from '@/components/chart-preview';
import { ReportPreview } from '@/components/report-preview';
import { PageHeader } from '@/components/page-header';
import { WorkbookPicker } from '@/components/workbook-picker';

type ExtraField =
  | {
      key: string;
      label: string;
      type: 'select';
      options: Array<{ label: string; value: string }>;
      defaultValue: string;
    }
  | {
      key: string;
      label: string;
      type: 'textarea';
      defaultValue: string;
      placeholder: string;
    };

export function TaskWorkspace({
  title,
  badge,
  subtitle,
  endpoint,
  resultHeading,
  promptPlaceholder,
  extraFields = [],
}: {
  title: string;
  badge: string;
  subtitle: string;
  endpoint: '/api/pivot-builder' | '/api/data-analysis' | '/api/charts' | '/api/reports';
  resultHeading: string;
  promptPlaceholder: string;
  extraFields?: ExtraField[];
}) {
  const [workbookId, setWorkbookId] = useState('');
  const [preview, setPreview] = useState<WorkbookPreview | null>(null);
  const [prompt, setPrompt] = useState('');
  const [fields, setFields] = useState<Record<string, string>>(
    Object.fromEntries(extraFields.map((field) => [field.key, field.defaultValue])),
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<unknown>(null);
  const resultObject =
    typeof result === 'object' && result !== null ? (result as Record<string, unknown>) : null;
  const analysisResult =
    endpoint === '/api/data-analysis' && resultObject
      ? (resultObject as AnalysisResult)
      : null;
  const chartResult =
    endpoint === '/api/charts' && resultObject ? (resultObject as ChartResult) : null;
  const downloadUrl =
    typeof resultObject?.exportFileUrl === 'string' ? resultObject.exportFileUrl : '';

  useEffect(() => {
    if (!workbookId) {
      setPreview(null);
      return;
    }

    void getWorkbookPreview(workbookId)
      .then(setPreview)
      .catch((err: Error) => setError(err.message));
  }, [workbookId]);

  async function runTask() {
    if (!workbookId) {
      setError('Please select a workbook first.');
      return;
    }

    setPending(true);
    setError('');
    setResult(null);

    const body: Record<string, unknown> = {
      workbookId,
      prompt,
    };

    for (const field of extraFields) {
      body[field.key] = fields[field.key];
    }

    if (endpoint === '/api/data-analysis' && preview) {
      body.sheetNames = preview.sheets.map((sheet) => sheet.sheetName);
    }

    try {
      const payload = await createToolJob(endpoint, body);
      const detail = await waitForJob(endpoint, payload.job.id);
      setResult(detail.result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Task execution failed');
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <PageHeader title={title} subtitle={subtitle} badge={badge} />

      <div className="split">
        <div className="grid">
          <WorkbookPicker value={workbookId} onChange={setWorkbookId} />
          <div className="panel">
            <div className="field">
              <label htmlFor={`${endpoint}-prompt`}>Goal</label>
              <textarea
                id={`${endpoint}-prompt`}
                className="textarea"
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder={promptPlaceholder}
              />
            </div>

            {extraFields.map((field) => (
              <div className="field" key={field.key}>
                <label htmlFor={field.key}>{field.label}</label>
                {field.type === 'select' ? (
                  <select
                    id={field.key}
                    className="select"
                    value={fields[field.key] ?? field.defaultValue}
                    onChange={(event) =>
                      setFields((current) => ({ ...current, [field.key]: event.target.value }))
                    }
                  >
                    {field.options.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <textarea
                    id={field.key}
                    className="textarea"
                    value={fields[field.key] ?? field.defaultValue}
                    placeholder={field.placeholder}
                    onChange={(event) =>
                      setFields((current) => ({ ...current, [field.key]: event.target.value }))
                    }
                  />
                )}
              </div>
            ))}

            <div className="button-row">
              <button
                type="button"
                className="button button-primary"
                disabled={pending}
                onClick={() => void runTask()}
              >
                {pending ? 'Running…' : 'Generate result'}
              </button>
              <button
                type="button"
                className="button button-secondary"
                onClick={() => {
                  setPrompt('');
                  setResult(null);
                  setError('');
                }}
              >
                Reset
              </button>
            </div>

            {error ? (
              <div className="empty-state" style={{ marginTop: 14, color: '#a14828' }}>
                {error}
              </div>
            ) : null}
          </div>
        </div>

        <div className="grid">
          <div className="panel">
            <h3>Workbook preview</h3>
            {!preview ? (
              <div className="empty-state">Choose a workbook to inspect sheet names and sample rows.</div>
            ) : (
              <>
                <div className="muted" style={{ marginBottom: 12 }}>
                  {preview.workbook.fileName} · {preview.workbook.sheetCount} sheet(s)
                </div>
                <div className="table-preview">
                  <table>
                    <thead>
                      <tr>
                        <th>Sheet</th>
                        <th>Rows</th>
                        <th>Columns</th>
                        <th>Headers</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.sheets.map((sheet) => (
                        <tr key={sheet.id}>
                          <td>{sheet.sheetName}</td>
                          <td>{sheet.rowCount}</td>
                          <td>{sheet.columnCount}</td>
                          <td>{sheet.headers.slice(0, 4).join(', ') || 'N/A'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>

          <div className="panel">
            <h3>{resultHeading}</h3>
            {!result ? (
              <div className="empty-state">
                Trigger the task to render a database-backed job result here.
              </div>
            ) : chartResult?.chartType ? (
              <ChartPreview chart={chartResult} preview={preview} />
            ) : analysisResult?.summaryMd ? (
              <div className="result-box markdown">
                <div style={{ marginBottom: 12, fontSize: 13, opacity: 0.85 }}>
                  Confidence: {analysisResult.confidenceScore ?? 'N/A'}
                </div>
                <div style={{ marginBottom: 8 }}>
                  <strong>Summary</strong>
                </div>
                <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{analysisResult.summaryMd}</pre>
                {analysisResult.insights?.length ? (
                  <div style={{ marginTop: 16 }}>
                    <strong>Insights</strong>
                    <ul style={{ margin: '8px 0 0 18px' }}>
                      {analysisResult.insights.map((insight) => (
                        <li key={`${insight.type}-${insight.title}`}>
                          <strong>{insight.title}:</strong> {insight.description}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {analysisResult.qualityWarnings?.length ? (
                  <div style={{ marginTop: 16 }}>
                    <strong>Quality warnings</strong>
                    <ul style={{ margin: '8px 0 0 18px' }}>
                      {analysisResult.qualityWarnings.map((warning, index) => (
                        <li key={`${warning.type ?? 'warning'}-${index}`}>
                          {String(warning.message ?? '')}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {analysisResult.followupSuggestions?.length ? (
                  <div style={{ marginTop: 16 }}>
                    <strong>Follow-up</strong>
                    <ul style={{ margin: '8px 0 0 18px' }}>
                      {analysisResult.followupSuggestions.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <details style={{ marginTop: 16 }}>
                  <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Raw JSON</summary>
                  <pre className="result-box" style={{ margin: '10px 0 0', overflow: 'auto' }}>
                    {JSON.stringify(result, null, 2)}
                  </pre>
                </details>
              </div>
            ) : typeof result === 'object' && result !== null && 'contentMd' in result ? (
              <>
                {downloadUrl ? (
                  <a
                    className="button button-primary"
                    href={downloadUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{ display: 'inline-flex', marginBottom: 12 }}
                  >
                    Download report
                  </a>
                ) : null}
                <div className="result-box">
                  <ReportPreview contentMd={String((result as { contentMd?: string }).contentMd ?? '')} />
                </div>
              </>
            ) : (
              <>
                {downloadUrl ? (
                  <a
                    className="button button-primary"
                    href={downloadUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{ display: 'inline-flex', marginBottom: 12 }}
                  >
                    Download xlsx
                  </a>
                ) : null}
                <pre className="result-box" style={{ margin: 0, overflow: 'auto' }}>
                  {JSON.stringify(result, null, 2)}
                </pre>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { getUsageHistory, getUsageSummary } from '@/lib/api';
import type { UsageSummary } from '@/lib/types';
import { PageHeader } from '@/components/page-header';

export default function UsagePage() {
  const [summary, setSummary] = useState<UsageSummary | null>(null);
  const [history, setHistory] = useState<Array<Record<string, unknown>>>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    void Promise.all([getUsageSummary(), getUsageHistory()])
      .then(([summaryPayload, historyPayload]) => {
        setSummary(summaryPayload);
        setHistory(historyPayload.items);
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  return (
    <>
      <PageHeader
        title="Usage History"
        subtitle="Review credits and recent task usage for the current billing cycle."
        badge="Usage analytics"
      />

      {error ? <div className="empty-state">{error}</div> : null}

      <div className="grid metric-grid">
        <div className="panel metric-card">
          <div className="muted">Plan</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800 }}>{summary?.plan ?? '-'}</div>
        </div>
        <div className="panel metric-card">
          <div className="muted">Credits used</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800 }}>{summary?.credits.used ?? 0}</div>
        </div>
        <div className="panel metric-card">
          <div className="muted">Credits remaining</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800 }}>{summary?.credits.remaining ?? 0}</div>
        </div>
        <div className="panel metric-card">
          <div className="muted">Metrics tracked</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800 }}>{summary?.metrics.length ?? 0}</div>
        </div>
      </div>

      <div className="panel" style={{ marginTop: 18 }}>
        <h3>Recent events</h3>
        <div className="list">
          {history.length === 0 ? (
            <div className="empty-state">No usage events recorded yet for this billing cycle.</div>
          ) : (
            history.map((item, index) => (
              <div key={`${item.id ?? index}`} className="list-item">
                <div style={{ fontWeight: 700 }}>{String(item.toolType ?? 'unknown_tool')}</div>
                <div className="muted" style={{ fontSize: '0.92rem' }}>
                  Credits: {String(item.creditDelta ?? 0)} | {String(item.createdAt ?? '')}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}

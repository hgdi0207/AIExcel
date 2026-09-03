'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getCurrentUser, getFiles, getUsageSummary } from '@/lib/api';
import type { AuthUser, UsageSummary, WorkbookItem } from '@/lib/types';
import { PageHeader } from '@/components/page-header';

const cards = [
  {
    href: '/pivot-builder',
    title: 'Pivot Builder',
    copy: 'Turn natural-language analysis goals into pivot layouts and exportable configs.',
  },
  {
    href: '/assistant',
    title: 'Spreadsheet Assistant',
    copy: 'Chat with AI over uploaded workbooks, formulas, and sheet structures.',
  },
  {
    href: '/data-analysis',
    title: 'Data Analysis',
    copy: 'Generate trend summaries, anomaly notes, and decision-ready insights.',
  },
  {
    href: '/charts',
    title: 'Charts & Graphs',
    copy: 'Recommend the right visual and return a chart-ready configuration.',
  },
  {
    href: '/reports',
    title: 'Reports',
    copy: 'Package analysis into reusable summaries, management notes, and exports.',
  },
];

export function DashboardClient() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [files, setFiles] = useState<WorkbookItem[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    void Promise.all([getCurrentUser(), getUsageSummary(), getFiles()])
      .then(([me, summary, filePayload]) => {
        setUser(me.user);
        setUsage(summary);
        setFiles(filePayload.items);
      })
      .catch((err: Error) => {
        setError(err.message);
      });
  }, []);

  return (
    <>
      <PageHeader
        title={`Welcome back${user ? `, ${user.name}` : ''}`}
        subtitle="Ship the homepage MVP first: Pivot Builder, Spreadsheet Assistant, Data Analysis, Charts & Graphs, and Reports all hang off the same workbook and quota model."
        badge={user ? `${user.plan.toUpperCase()} plan` : 'MVP shell'}
      />

      {error ? (
        <div className="empty-state" style={{ marginBottom: 18 }}>
          Session not ready yet. Use the mock callback on the login page to set cookies, then come back here.
        </div>
      ) : null}

      <div className="grid dashboard-grid">
        {cards.map((card) => (
          <Link key={card.href} href={card.href} className="dashboard-card">
            <div>
              <div className="badge" style={{ marginBottom: 12 }}>
                Core task
              </div>
              <h3 style={{ margin: 0 }}>{card.title}</h3>
              <p className="muted" style={{ marginBottom: 0 }}>
                {card.copy}
              </p>
            </div>
            <div style={{ fontWeight: 700 }}>Open workspace →</div>
          </Link>
        ))}
      </div>

      <div className="grid metric-grid" style={{ marginTop: 18 }}>
        <div className="panel metric-card">
          <div className="muted">Credits remaining</div>
          <div style={{ fontSize: '2rem', fontWeight: 800 }}>
            {usage ? usage.credits.remaining : '—'}
          </div>
        </div>
        <div className="panel metric-card">
          <div className="muted">Workbooks ready</div>
          <div style={{ fontSize: '2rem', fontWeight: 800 }}>{files.length}</div>
        </div>
        <div className="panel metric-card">
          <div className="muted">Top metric</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800 }}>
            {usage?.metrics[0]?.metricType ?? 'No usage yet'}
          </div>
        </div>
      </div>

      <div className="grid" style={{ marginTop: 18 }}>
        <div className="panel">
          <h3>Recent workbooks</h3>
          <div className="list">
            {files.length === 0 ? (
              <div className="empty-state">
                No workbook uploaded yet. Start from any tool page and upload your first file.
              </div>
            ) : (
              files.slice(0, 5).map((item) => (
                <div key={item.id} className="list-item">
                  <div style={{ fontWeight: 700 }}>{item.fileName}</div>
                  <div className="muted" style={{ fontSize: '0.92rem' }}>
                    {item.sheetCount} sheets · {item.rowCount} rows · {item.columnCount} columns
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}

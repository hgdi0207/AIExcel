'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getCurrentUser, getFiles, getUsageSummary } from '@/lib/api';
import type { AuthUser, UsageSummary, WorkbookItem } from '@/lib/types';

const tools = [
  { href: '/assistant', title: 'AI Chat', icon: 'AI', copy: 'Ask questions and work with uploaded spreadsheets.' },
  { href: '/pivot-builder', title: 'Pivot Tables', icon: 'PT', copy: 'Create and analyze pivot tables with AI.', badge: 'New' },
  { href: '/formulas', title: 'Formulas', icon: 'FX', copy: 'Generate and explain spreadsheet formulas.' },
  { href: '/scripts', title: 'Scripts', icon: '</>', copy: 'Generate and explain VBA or Apps Script.' },
  { href: '/data-analysis', title: 'Data Analysis', icon: 'DA', copy: 'Find trends, anomalies, and insights.' },
  { href: '/charts', title: 'Charts', icon: 'CH', copy: 'Create chart recommendations from data.' },
  { href: '/reports', title: 'Reports', icon: 'RP', copy: 'Turn spreadsheet data into reports.' },
  { href: '/billing', title: 'Billing', icon: '$', copy: 'Manage your plan and subscription.' },
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
      .catch((reason: Error) => setError(reason.message));
  }, []);

  return (
    <div className="p-5 md:p-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-text-primary mb-2">Dashboard</h1>
        <p className="text-text-secondary">Overview of your app</p>
      </div>
      <div className="mb-6 bg-gradient-to-r from-brand-green/10 to-purple-500/10 rounded-lg p-6 border border-brand-green/20">
        <div className="text-xl font-semibold text-text-primary">Welcome{user ? `, ${user.name}` : ''}!</div>
        <p className="text-text-secondary mt-2">You have {usage?.credits.remaining ?? '-'} credits remaining and {files.length} workbooks ready.</p>
      </div>
      {error ? <div className="mb-6 p-4 border border-red-200 bg-red-50 text-error-red rounded-md">{error}</div> : null}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
        {tools.map((tool) => (
          <Link key={tool.href} href={tool.href} className="relative group bg-white border border-border-gray rounded-md p-6 hover:shadow-card hover:-translate-y-1 transition-all duration-300">
            {tool.badge ? <span className="absolute top-3 right-3 bg-brand-green text-white text-xs px-2 py-1 rounded-full">{tool.badge}</span> : null}
            <div className="w-10 h-10 mb-4 rounded-md bg-bg-gray flex items-center justify-center text-sm font-bold text-brand-green-dark">{tool.icon}</div>
            <h3 className="text-lg font-semibold text-text-primary mb-2 group-hover:text-brand-green-dark transition">{tool.title}</h3>
            <p className="text-sm text-text-secondary">{tool.copy}</p>
          </Link>
        ))}
      </div>
      <div className="mt-8 bg-white border border-border-gray rounded-md p-6">
        <h2 className="text-lg font-semibold mb-4">Recent workbooks</h2>
        {files.length ? files.slice(0, 5).map((file) => (
          <div key={file.id} className="py-3 border-t border-border-gray first:border-0">
            <strong>{file.fileName}</strong>
            <span className="ml-3 text-sm text-text-secondary">{file.sheetCount} sheets, {file.rowCount} rows</span>
          </div>
        )) : <p className="text-text-secondary">No workbook uploaded yet.</p>}
      </div>
    </div>
  );
}

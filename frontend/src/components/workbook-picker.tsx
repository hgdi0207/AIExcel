'use client';

import { useEffect, useState } from 'react';
import { getFiles, uploadWorkbook } from '@/lib/api';
import type { WorkbookItem } from '@/lib/types';

export function WorkbookPicker({
  value,
  onChange,
  title = 'Data source',
}: {
  value: string;
  onChange: (workbookId: string) => void;
  title?: string;
}) {
  const [items, setItems] = useState<WorkbookItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  async function refresh() {
    setLoading(true);
    setError('');
    try {
      const payload = await getFiles();
      setItems(payload.items);
      if (!value && payload.items[0]) {
        onChange(payload.items[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load files');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function onFileSelected(file: File | null) {
    if (!file) {
      return;
    }
    setUploading(true);
    setError('');
    try {
      const payload = await uploadWorkbook(file);
      await refresh();
      onChange(payload.workbook.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="panel">
      <h3 style={{ marginBottom: 6 }}>{title}</h3>
      <p className="muted" style={{ marginTop: 0 }}>
        Upload `.xlsx`, `.xls`, or `.csv` once and reuse it across all AI tools.
      </p>

      <div className="field">
        <label htmlFor="workbook-select">Workbook</label>
        <select
          id="workbook-select"
          className="select"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={loading || uploading}
        >
          <option value="">Select a workbook</option>
          {items.map((item) => (
            <option key={item.id} value={item.id}>
              {item.fileName} · {item.sheetCount} sheet(s)
            </option>
          ))}
        </select>
      </div>

      <div className="file-drop">
        <div style={{ fontWeight: 700, marginBottom: 8 }}>
          {uploading ? 'Uploading workbook…' : 'Need a fresh file?'}
        </div>
        <div className="muted" style={{ marginBottom: 14 }}>
          Drag-and-drop can come later. For now, click to upload and parse into the database-backed workbook store.
        </div>
        <label className="button button-secondary" style={{ display: 'inline-flex' }}>
          Choose file
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            hidden
            onChange={(event) => void onFileSelected(event.target.files?.[0] ?? null)}
          />
        </label>
      </div>

      {error ? (
        <div className="empty-state" style={{ marginTop: 14, color: '#a14828' }}>
          {error}
        </div>
      ) : null}

      <div className="list" style={{ marginTop: 14 }}>
        {items.slice(0, 3).map((item) => (
          <div key={item.id} className="list-item">
            <div style={{ fontWeight: 700 }}>{item.fileName}</div>
            <div className="muted" style={{ fontSize: '0.92rem' }}>
              {item.rowCount} rows · {item.columnCount} columns · uploaded{' '}
              {new Date(item.uploadedAt).toLocaleString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

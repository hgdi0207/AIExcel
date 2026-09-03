'use client';

import { useId, useRef, useState } from 'react';
import type { ChartResult, WorkbookPreview } from '@/lib/types';

const CHART_COLORS = ['#c7522a', '#f0a04b', '#6b8f71', '#2f4858', '#b56576', '#457b9d'];

type ChartPreviewProps = {
  chart: ChartResult;
  preview: WorkbookPreview | null;
};

type SeriesPoint = {
  label: string;
  value: number;
};

type ScatterPoint = {
  label: string;
  x: number;
  y: number;
};

export function ChartPreview({ chart, preview }: ChartPreviewProps) {
  const svgId = useId();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const title = chart.title?.trim() || 'Chart Preview';
  const sourceSheetName = chart.config?.sourceSheet?.trim() || preview?.sheets[0]?.sheetName || '';
  const sourceSheet =
    preview?.sheets.find((sheet) => sheet.sheetName === sourceSheetName) ?? preview?.sheets[0] ?? null;
  const xAxisField = chart.config?.xAxisField?.trim() || chart.xAxis?.trim() || '';
  const yAxisField = chart.config?.yAxisField?.trim() || chart.yAxis?.trim() || '';
  const chartType = normalizeChartType(chart.chartType);
  const seriesPoints = chartType === 'scatter' ? [] : buildSeriesPoints(chart, sourceSheet, xAxisField, yAxisField);
  const scatterPoints = chartType === 'scatter' ? buildScatterPoints(chart, sourceSheet, xAxisField, yAxisField) : [];
  const hasData = chartType === 'scatter' ? scatterPoints.length > 0 : seriesPoints.length > 0;
  const [isExportingPng, setIsExportingPng] = useState(false);
  const [exportError, setExportError] = useState('');
  const baseFileName = buildFileName(title, chartType);

  async function handleDownloadPng() {
    const svgElement = containerRef.current?.querySelector('svg');
    if (!svgElement) {
      setExportError('Chart SVG is not available yet.');
      return;
    }

    try {
      setExportError('');
      setIsExportingPng(true);
      await downloadSvgAsPng(svgElement, `${baseFileName}.png`);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'PNG export failed.');
    } finally {
      setIsExportingPng(false);
    }
  }

  return (
    <div className="result-box" style={{ margin: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{title}</div>
          <div className="muted" style={{ marginTop: 4 }}>
            {(sourceSheet?.sheetName || 'Unknown sheet') +
              ' | ' +
              chartType +
              ' | X: ' +
              (xAxisField || 'N/A') +
              ' | Y: ' +
              (yAxisField || 'N/A')}
          </div>
          {chart.sourceSummary ? (
            <div className="muted" style={{ marginTop: 6, maxWidth: 720 }}>
              {chart.sourceSummary}
            </div>
          ) : null}
        </div>
        {hasData ? (
          <div className="button-row" style={{ alignItems: 'flex-start' }}>
            <button
              type="button"
              className="button button-secondary"
              onClick={() =>
                downloadTextFile(`${baseFileName}.svg`, getStandaloneSvgMarkup(svgId, containerRef.current?.querySelector('svg') ?? null))
              }
            >
              Download SVG
            </button>
            <button type="button" className="button button-secondary" disabled={isExportingPng} onClick={() => void handleDownloadPng()}>
              {isExportingPng ? 'Exporting PNG...' : 'Download PNG'}
            </button>
            <button
              type="button"
              className="button button-secondary"
              onClick={() => downloadTextFile(`${baseFileName}.json`, JSON.stringify(chart, null, 2))}
            >
              Download JSON
            </button>
          </div>
        ) : null}
      </div>
      {exportError ? (
        <div className="empty-state" style={{ marginTop: 12, minHeight: 0, color: '#a14828' }}>
          {exportError}
        </div>
      ) : null}

      <div
        ref={containerRef}
        style={{
          marginTop: 16,
          borderRadius: 18,
          background: 'rgba(255,255,255,0.76)',
          border: '1px solid rgba(47,72,88,0.12)',
          padding: 14,
        }}
      >
        {hasData ? (
          <ChartSvg
            svgId={svgId}
            chartType={chartType}
            seriesPoints={seriesPoints}
            scatterPoints={scatterPoints}
            xAxisLabel={xAxisField}
            yAxisLabel={yAxisField}
          />
        ) : (
          <div className="empty-state" style={{ minHeight: 180 }}>
            No chart data is available for this result yet.
          </div>
        )}
      </div>

      {hasData ? (
        <div style={{ marginTop: 14 }}>
          <strong>Preview data</strong>
          <div className="table-preview" style={{ marginTop: 10 }}>
            <table>
              <thead>
                <tr>
                  <th>{xAxisField || 'Label'}</th>
                  <th>{yAxisField || 'Value'}</th>
                </tr>
              </thead>
              <tbody>
                {chartType === 'scatter'
                  ? scatterPoints.map((point) => (
                      <tr key={`${point.label}-${point.x}-${point.y}`}>
                        <td>{point.label ? `${point.label} (${formatValue(point.x)})` : formatValue(point.x)}</td>
                        <td>{formatValue(point.y)}</td>
                      </tr>
                    ))
                  : seriesPoints.map((point) => (
                      <tr key={`${point.label}-${point.value}`}>
                        <td>{point.label}</td>
                        <td>{formatValue(point.value)}</td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ChartSvg({
  svgId,
  chartType,
  seriesPoints,
  scatterPoints,
  xAxisLabel,
  yAxisLabel,
}: {
  svgId: string;
  chartType: 'bar' | 'line' | 'pie' | 'scatter';
  seriesPoints: SeriesPoint[];
  scatterPoints: ScatterPoint[];
  xAxisLabel: string;
  yAxisLabel: string;
}) {
  if (chartType === 'pie') {
    return <PieChart svgId={svgId} points={seriesPoints} />;
  }

  if (chartType === 'scatter') {
    return <ScatterChart svgId={svgId} points={scatterPoints} xAxisLabel={xAxisLabel} yAxisLabel={yAxisLabel} />;
  }

  return (
    <CartesianSeriesChart
      svgId={svgId}
      points={seriesPoints}
      chartType={chartType}
      xAxisLabel={xAxisLabel}
      yAxisLabel={yAxisLabel}
    />
  );
}

function CartesianSeriesChart({
  svgId,
  points,
  chartType,
  xAxisLabel,
  yAxisLabel,
}: {
  svgId: string;
  points: SeriesPoint[];
  chartType: 'bar' | 'line';
  xAxisLabel: string;
  yAxisLabel: string;
}) {
  const width = 520;
  const height = 260;
  const left = 56;
  const right = 18;
  const top = 18;
  const bottom = 42;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const maxValue = Math.max(...points.map((point) => point.value), 1);

  const coords = points.map((point, index) => {
    const x =
      points.length === 1 ? left + plotWidth / 2 : left + (plotWidth * index) / Math.max(points.length - 1, 1);
    const y = top + plotHeight - (point.value / maxValue) * plotHeight;
    return { ...point, x, y };
  });
  const polyline = coords.map((point) => `${point.x},${point.y}`).join(' ');

  return (
    <svg id={svgId} viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      <line x1={left} y1={top} x2={left} y2={top + plotHeight} stroke="#6f665b" strokeWidth="1.4" />
      <line
        x1={left}
        y1={top + plotHeight}
        x2={left + plotWidth}
        y2={top + plotHeight}
        stroke="#6f665b"
        strokeWidth="1.4"
      />

      {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
        const y = top + plotHeight - plotHeight * ratio;
        const value = maxValue * ratio;
        return (
          <g key={ratio}>
            <line x1={left} y1={y} x2={left + plotWidth} y2={y} stroke="rgba(47,72,88,0.10)" strokeWidth="1" />
            <text x={left - 8} y={y + 4} textAnchor="end" fontSize="11" fill="#6f665b">
              {formatValue(value)}
            </text>
          </g>
        );
      })}

      {chartType === 'line' ? (
        <polyline
          fill="none"
          stroke="#c7522a"
          strokeWidth="3"
          strokeLinejoin="round"
          strokeLinecap="round"
          points={polyline}
        />
      ) : null}

      {coords.map((point, index) => {
        const color = CHART_COLORS[index % CHART_COLORS.length];
        const barWidth = Math.min(38, (plotWidth / Math.max(points.length, 1)) * 0.55);
        const barX = point.x - barWidth / 2;
        const barY = point.y;
        const barHeight = top + plotHeight - point.y;

        return (
          <g key={`${point.label}-${index}`}>
            {chartType === 'bar' ? (
              <rect x={barX} y={barY} width={barWidth} height={barHeight} rx="8" fill={color} opacity="0.88" />
            ) : (
              <circle cx={point.x} cy={point.y} r={4.5} fill={color} />
            )}
            <text x={point.x} y={top + plotHeight + 18} textAnchor="middle" fontSize="11" fill="#6f665b">
              {truncate(point.label, 10)}
            </text>
          </g>
        );
      })}

      <text x={left + plotWidth / 2} y={height - 8} textAnchor="middle" fontSize="12" fill="#2f4858">
        {xAxisLabel || 'X Axis'}
      </text>
      <text
        x={16}
        y={top + plotHeight / 2}
        textAnchor="middle"
        fontSize="12"
        fill="#2f4858"
        transform={`rotate(-90 16 ${top + plotHeight / 2})`}
      >
        {yAxisLabel || 'Y Axis'}
      </text>
    </svg>
  );
}

function ScatterChart({
  svgId,
  points,
  xAxisLabel,
  yAxisLabel,
}: {
  svgId: string;
  points: ScatterPoint[];
  xAxisLabel: string;
  yAxisLabel: string;
}) {
  const width = 520;
  const height = 260;
  const left = 56;
  const right = 18;
  const top = 18;
  const bottom = 42;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const minX = Math.min(...points.map((point) => point.x));
  const maxX = Math.max(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  const maxY = Math.max(...points.map((point) => point.y));
  const xRange = maxX - minX || 1;
  const yRange = maxY - minY || 1;

  const coords = points.map((point) => ({
    ...point,
    px: left + ((point.x - minX) / xRange) * plotWidth,
    py: top + plotHeight - ((point.y - minY) / yRange) * plotHeight,
  }));

  return (
    <svg id={svgId} viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      <line x1={left} y1={top} x2={left} y2={top + plotHeight} stroke="#6f665b" strokeWidth="1.4" />
      <line
        x1={left}
        y1={top + plotHeight}
        x2={left + plotWidth}
        y2={top + plotHeight}
        stroke="#6f665b"
        strokeWidth="1.4"
      />

      {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
        const gridX = left + plotWidth * ratio;
        const gridY = top + plotHeight - plotHeight * ratio;
        const xValue = minX + xRange * ratio;
        const yValue = minY + yRange * ratio;

        return (
          <g key={ratio}>
            <line x1={gridX} y1={top} x2={gridX} y2={top + plotHeight} stroke="rgba(47,72,88,0.08)" strokeWidth="1" />
            <line x1={left} y1={gridY} x2={left + plotWidth} y2={gridY} stroke="rgba(47,72,88,0.08)" strokeWidth="1" />
            <text x={gridX} y={top + plotHeight + 18} textAnchor="middle" fontSize="11" fill="#6f665b">
              {formatValue(xValue)}
            </text>
            <text x={left - 8} y={gridY + 4} textAnchor="end" fontSize="11" fill="#6f665b">
              {formatValue(yValue)}
            </text>
          </g>
        );
      })}

      {coords.map((point, index) => (
        <g key={`${point.label}-${point.x}-${point.y}`}>
          <circle cx={point.px} cy={point.py} r={6} fill={CHART_COLORS[index % CHART_COLORS.length]} opacity="0.9" />
          <text x={point.px} y={point.py - 10} textAnchor="middle" fontSize="11" fill="#2f4858">
            {truncate(point.label || `${index + 1}`, 10)}
          </text>
        </g>
      ))}

      <text x={left + plotWidth / 2} y={height - 8} textAnchor="middle" fontSize="12" fill="#2f4858">
        {xAxisLabel || 'X Axis'}
      </text>
      <text
        x={16}
        y={top + plotHeight / 2}
        textAnchor="middle"
        fontSize="12"
        fill="#2f4858"
        transform={`rotate(-90 16 ${top + plotHeight / 2})`}
      >
        {yAxisLabel || 'Y Axis'}
      </text>
    </svg>
  );
}

function PieChart({ svgId, points }: { svgId: string; points: SeriesPoint[] }) {
  const width = 520;
  const height = 260;
  const cx = 170;
  const cy = height / 2;
  const radius = 82;
  const total = points.reduce((sum, point) => sum + point.value, 0) || 1;
  let cumulative = -Math.PI / 2;

  return (
    <svg id={svgId} viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      {points.map((point, index) => {
        const ratio = point.value / total;
        const arc = ratio * Math.PI * 2;
        const x1 = cx + radius * Math.cos(cumulative);
        const y1 = cy + radius * Math.sin(cumulative);
        cumulative += arc;
        const x2 = cx + radius * Math.cos(cumulative);
        const y2 = cy + radius * Math.sin(cumulative);
        const largeArc = arc > Math.PI ? 1 : 0;
        const path = `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;
        const color = CHART_COLORS[index % CHART_COLORS.length];
        return <path key={`${point.label}-${index}`} d={path} fill={color} opacity="0.9" />;
      })}

      {points.map((point, index) => (
        <g key={`${point.label}-legend`} transform={`translate(300 ${36 + index * 28})`}>
          <rect width="14" height="14" rx="4" fill={CHART_COLORS[index % CHART_COLORS.length]} />
          <text x="22" y="12" fontSize="12" fill="#2f4858">
            {truncate(point.label, 18)} | {formatValue(point.value)}
          </text>
        </g>
      ))}
    </svg>
  );
}

function normalizeChartType(value: ChartResult['chartType']): 'bar' | 'line' | 'pie' | 'scatter' {
  if (value === 'bar' || value === 'line' || value === 'pie' || value === 'scatter') {
    return value;
  }

  return 'line';
}

function buildSeriesPoints(
  chart: ChartResult,
  sheet: WorkbookPreview['sheets'][number] | null,
  xAxisField: string,
  yAxisField: string,
) {
  const chartData = chart.chartData;
  const pointData = chartData?.points
    ?.map((point) => ({
      label: String(point.label ?? '').trim(),
      value: Number(point.value),
    }))
    .filter((point) => point.label && Number.isFinite(point.value));
  if (pointData && pointData.length > 0) {
    return pointData.slice(0, 12);
  }

  const labelData = chartData?.labels ?? [];
  const valueData = chartData?.values ?? [];
  if (labelData.length > 0 && valueData.length > 0) {
    return labelData
      .map((label, index) => ({
        label: String(label ?? '').trim(),
        value: Number(valueData[index]),
      }))
      .filter((point) => point.label && Number.isFinite(point.value))
      .slice(0, 12);
  }

  return buildSeriesPointsFromSheet(sheet, xAxisField, yAxisField).slice(0, 12);
}

function buildScatterPoints(
  chart: ChartResult,
  sheet: WorkbookPreview['sheets'][number] | null,
  xAxisField: string,
  yAxisField: string,
) {
  const pointData = chart.chartData?.points
    ?.map((point, index) => ({
      label: String(point.label ?? `${index + 1}`).trim(),
      x: Number(point.x),
      y: Number(point.y),
    }))
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
  if (pointData && pointData.length > 0) {
    return pointData.slice(0, 24);
  }

  return buildScatterPointsFromSheet(sheet, xAxisField, yAxisField).slice(0, 24);
}

function buildSeriesPointsFromSheet(
  sheet: WorkbookPreview['sheets'][number] | null,
  xAxisField: string,
  yAxisField: string,
) {
  if (!sheet || !xAxisField || !yAxisField) {
    return [];
  }

  const xIndex = sheet.headers.findIndex((header) => header === xAxisField);
  const yIndex = sheet.headers.findIndex((header) => header === yAxisField);
  if (xIndex < 0 || yIndex < 0) {
    return [];
  }

  return sheet.sampleRows
    .map((row) => ({
      label: String(row[xIndex] ?? '').trim(),
      value: parseNumericValue(row[yIndex]),
    }))
    .filter((point) => point.label && Number.isFinite(point.value));
}

function buildScatterPointsFromSheet(
  sheet: WorkbookPreview['sheets'][number] | null,
  xAxisField: string,
  yAxisField: string,
) {
  if (!sheet || !xAxisField || !yAxisField) {
    return [];
  }

  const xIndex = sheet.headers.findIndex((header) => header === xAxisField);
  const yIndex = sheet.headers.findIndex((header) => header === yAxisField);
  if (xIndex < 0 || yIndex < 0) {
    return [];
  }

  return sheet.sampleRows
    .map((row, index) => ({
      label: String(row[0] ?? `${index + 1}`).trim(),
      x: parseNumericValue(row[xIndex]),
      y: parseNumericValue(row[yIndex]),
    }))
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
}

function parseNumericValue(value: unknown) {
  const normalized = String(value ?? '')
    .replace(/,/g, '')
    .replace(/[%$]/g, '')
    .trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function formatValue(value: number) {
  if (Math.abs(value) >= 1000) {
    return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
  }

  return value.toFixed(value % 1 === 0 ? 0 : 2);
}

function truncate(value: string, limit: number) {
  if (value.length <= limit) {
    return value;
  }

  return `${value.slice(0, limit - 1)}...`;
}

function buildFileName(title: string, chartType: string) {
  const normalized = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || `chart-${chartType}`;
}

function downloadTextFile(fileName: string, content: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  triggerDownload(url, fileName);
  URL.revokeObjectURL(url);
}

function getStandaloneSvgMarkup(svgId: string, svgElement: SVGSVGElement | null) {
  if (!svgElement) {
    return '';
  }

  const clone = svgElement.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('id', svgId);
  if (!clone.getAttribute('xmlns')) {
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  }
  if (!clone.getAttribute('xmlns:xlink')) {
    clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
  }
  if (!clone.getAttribute('width')) {
    clone.setAttribute('width', clone.viewBox.baseVal.width.toString() || '520');
  }
  if (!clone.getAttribute('height')) {
    clone.setAttribute('height', clone.viewBox.baseVal.height.toString() || '260');
  }

  return new XMLSerializer().serializeToString(clone);
}

async function downloadSvgAsPng(svgElement: SVGSVGElement, fileName: string) {
  const svgMarkup = getStandaloneSvgMarkup(svgElement.id || 'chart-preview-svg', svgElement);
  if (!svgMarkup) {
    throw new Error('Chart SVG is empty.');
  }

  const svgBlob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
  const svgUrl = URL.createObjectURL(svgBlob);

  try {
    const image = await loadSvgImage(svgUrl);
    const width = Number(svgElement.viewBox.baseVal.width) || 520;
    const height = Number(svgElement.viewBox.baseVal.height) || 260;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Canvas context is unavailable.');
    }

    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);

    const pngBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
          return;
        }
        reject(new Error('Failed to create PNG blob.'));
      }, 'image/png');
    });

    const pngUrl = URL.createObjectURL(pngBlob);
    triggerDownload(pngUrl, fileName);
    URL.revokeObjectURL(pngUrl);
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}

function loadSvgImage(svgUrl: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to render SVG image.'));
    image.src = svgUrl;
  });
}

function triggerDownload(url: string, fileName: string) {
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

import { BadRequestException, Injectable } from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';
import * as XLSX from 'xlsx';
import type {
  AnalysisContext,
  AnalysisFactPack,
  ChartContext,
  AnalysisQualityWarning,
  WorkbookAnalysisCandidateDataset,
  WorkbookAnalysisFieldProfile,
  WorkbookAnalysisQualityProfile,
  WorkbookAnalysisSheetProfile,
  WorkbookAnalysisSnapshot,
  WorkbookAnalysisTableRegion,
  WorkbookAnalysisWorkbookQuality,
} from './workbook-analysis.types';

type WorkbookSource = {
  buffer?: Buffer;
  filePath?: string;
  fileName: string;
};

type RawSheetMatrix = string[][];

type WorkbookSheetBuildResult = {
  sheetName: string;
  sheetIndex: number;
  headers: string[];
  columnTypes: string[];
  formulaColumns: string[];
  sampleRows: string[][];
  dataRows: string[][];
  rowCount: number;
  columnCount: number;
  tableRegions: WorkbookAnalysisTableRegion[];
  fieldProfiles: WorkbookAnalysisFieldProfile[];
  qualityProfile: WorkbookAnalysisQualityProfile;
  summaryMd: string;
  confidence: number;
  isPrimary: boolean;
};

@Injectable()
export class WorkbookAnalysisService {
  analyzeWorkbookFromBuffer(buffer: Buffer, fileName: string): WorkbookAnalysisSnapshot {
    return this.analyzeWorkbook({ buffer, fileName });
  }

  analyzeWorkbookFromFile(filePath: string, fileName: string): WorkbookAnalysisSnapshot {
    return this.analyzeWorkbook({ filePath, fileName });
  }

  buildAnalysisContext(
    snapshot: WorkbookAnalysisSnapshot,
    input: {
      requestedSheetNames?: string[];
      prompt: string;
      complexity: 'normal' | 'complex';
    },
  ): AnalysisContext {
    const selectedSheets = this.selectSheets(snapshot.sheets, input.requestedSheetNames);
    const primarySheet = selectedSheets[0] ?? snapshot.sheets[0];
    if (!primarySheet) {
      throw new BadRequestException('Workbook has no analyzable sheets');
    }

    const factPack = this.buildFactPack(primarySheet, selectedSheets, input.prompt);
    const qualityWarnings = this.buildQualityWarnings(primarySheet, selectedSheets, factPack);
    const confidenceScore = this.computeConfidence(primarySheet, selectedSheets, qualityWarnings);
    const followupSuggestions = this.buildFollowupSuggestions(primarySheet, factPack, qualityWarnings);

    return {
      dataset: {
        sheetName: primarySheet.sheetName,
        regionId: primarySheet.tableRegions[0]?.regionId ?? `${primarySheet.sheetName}-region-1`,
        range: primarySheet.tableRegions[0]?.range ?? 'A1',
        headers: primarySheet.headers,
        rowCount: primarySheet.rowCount,
        columnCount: primarySheet.columnCount,
        timeField: this.findTimeField(primarySheet.fieldProfiles),
        metricField: this.findMetricField(primarySheet.fieldProfiles),
        dimensionField: this.findDimensionField(primarySheet.fieldProfiles),
      },
      summaryMd: this.buildAnalysisSummaryMd(primarySheet, factPack, qualityWarnings),
      factPack,
      qualityWarnings,
      followupSuggestions,
      confidenceScore,
    };
  }

  buildChartContext(
    snapshot: WorkbookAnalysisSnapshot,
    input: {
      prompt: string;
      preferredChartType: 'bar' | 'line' | 'pie' | 'scatter';
      requestedSheetName?: string;
    },
  ): ChartContext {
    const selectedSheet =
      snapshot.sheets.find(
        (sheet) =>
          input.requestedSheetName &&
          sheet.sheetName.trim().toLowerCase() === input.requestedSheetName.trim().toLowerCase(),
      ) ?? this.pickPrimarySheet(snapshot.sheets) ?? snapshot.sheets[0];

    if (!selectedSheet) {
      throw new BadRequestException('Workbook has no analyzable sheets');
    }

    const timeField = this.findTimeField(selectedSheet.fieldProfiles);
    const metricField = this.findMetricField(selectedSheet.fieldProfiles);
    const dimensionField = this.findDimensionField(selectedSheet.fieldProfiles);
    const chartType = this.resolveChartType(
      input.preferredChartType,
      input.prompt,
      timeField,
      metricField,
      selectedSheet.fieldProfiles,
    );

    const scatterFields = chartType === 'scatter' ? this.findScatterFields(selectedSheet.fieldProfiles) : null;
    let xAxis = timeField ?? dimensionField ?? selectedSheet.headers[0] ?? 'Category';
    let yAxis = metricField ?? selectedSheet.headers[1] ?? selectedSheet.headers[0] ?? 'Value';

    if (scatterFields) {
      xAxis = scatterFields.xField;
      yAxis = scatterFields.yField;
    }

    const chartData = this.buildChartData(selectedSheet, chartType, xAxis, yAxis, dimensionField);
    const title = this.buildChartTitle(chartType, xAxis, yAxis, input.prompt);

    return {
      title,
      chartType,
      xAxis,
      yAxis,
      config: {
        xAxisField: xAxis,
        yAxisField: yAxis,
        sourceSheet: selectedSheet.sheetName,
      },
      chartData,
      sourceSummary: `${selectedSheet.sheetName} · ${chartData.sourceKind} · ${chartData.points?.length ?? chartData.labels?.length ?? 0} point(s)`,
    };
  }

  private analyzeWorkbook(source: WorkbookSource): WorkbookAnalysisSnapshot {
    const workbook = this.readWorkbook(source);
    if (workbook.SheetNames.length === 0) {
      throw new BadRequestException('Workbook has no sheets');
    }

    const sheetResults = workbook.SheetNames.map((sheetName, sheetIndex) =>
      this.buildSheetProfile(workbook, sheetName, sheetIndex),
    );

    const totalRowCount = sheetResults.reduce((sum, sheet) => sum + sheet.rowCount, 0);
    const maxColumnCount = sheetResults.reduce((max, sheet) => Math.max(max, sheet.columnCount), 0);
    const primarySheet = this.pickPrimarySheet(sheetResults);
    const candidateDatasets = this.buildCandidateDatasets(sheetResults);
    const workbookQuality = this.buildWorkbookQuality(sheetResults);

    const summaryMd = [
      '## Workbook Summary',
      '',
      `- Sheets: ${workbook.SheetNames.length}`,
      `- Rows: ${totalRowCount}`,
      `- Columns: ${maxColumnCount}`,
      `- Primary dataset: ${primarySheet?.sheetName ?? 'N/A'}`,
      '',
      ...sheetResults.map((sheet) => sheet.summaryMd),
    ].join('\n');

    return {
      workbook: {
        sheetCount: workbook.SheetNames.length,
        rowCount: totalRowCount,
        columnCount: maxColumnCount,
        summaryMd,
        summaryJson: {
          sheetCount: workbook.SheetNames.length,
          rowCount: totalRowCount,
          columnCount: maxColumnCount,
          candidateDatasets,
          workbookQuality,
        },
        candidateDatasets,
        workbookQuality,
      },
      sheets: sheetResults,
    };
  }

  private buildSheetProfile(workbook: XLSX.WorkBook, sheetName: string, sheetIndex: number) {
    const worksheet = workbook.Sheets[sheetName];
    const rows = this.readSheetRows(worksheet);
    const columnCount = rows.reduce((max, row) => Math.max(max, row.length), 0);
    const headerRowIndex = this.detectHeaderRowIndex(rows);
    const headerRow = rows[headerRowIndex] ?? [];
    const headers = this.buildHeaders(headerRow, columnCount);
    const dataRows = rows.slice(headerRowIndex + 1).filter((row) => !this.isBlankRow(row));
    const sampleRows = dataRows.slice(0, 5);
    const rowCount = dataRows.length;
    const tableRange = this.buildRange(headerRowIndex, rowCount, columnCount);
    const tableRegions = [
      {
        regionId: `${this.sanitizeId(sheetName)}-region-1`,
        range: tableRange,
        headerRowIndex: headerRowIndex + 1,
        dataStartRowIndex: headerRowIndex + 2,
        rowCount,
        columnCount,
        confidence: this.computeRegionConfidence(headers, dataRows),
        isPrimary: true,
      },
    ];
    const fieldProfiles = this.buildFieldProfiles(headers, dataRows);
    const columnTypes = fieldProfiles.map((field) => field.dataType);
    const formulaColumns: string[] = [];
    const qualityProfile = this.buildQualityProfile(headers, dataRows, fieldProfiles);
    const confidence = this.computeRegionConfidence(headers, dataRows);
    const isPrimary = rowCount > 0 && headers.length > 0;

    return {
      id: `${this.sanitizeId(sheetName)}-${sheetIndex + 1}`,
      sheetName,
      sheetIndex,
      headers,
      columnTypes,
      formulaColumns,
      sampleRows,
      dataRows,
      rowCount,
      columnCount,
      tableRegions,
      fieldProfiles,
      qualityProfile,
      summaryMd: [
        `### ${sheetName}`,
        '',
        `- Rows: ${rowCount}`,
        `- Columns: ${columnCount}`,
        `- Headers: ${headers.length > 0 ? headers.join(', ') : 'N/A'}`,
        `- Primary region: ${tableRange}`,
        `- Key fields: ${fieldProfiles
          .filter((field) => field.semanticRole === 'time' || field.semanticRole === 'metric' || field.semanticRole === 'dimension')
          .slice(0, 3)
          .map((field) => `${field.fieldName}(${field.semanticRole})`)
          .join(', ') || 'N/A'}`,
      ].join('\n'),
      confidence,
      isPrimary,
    };
  }

  private buildAnalysisSummaryMd(
    primarySheet: WorkbookAnalysisSheetProfile,
    factPack: AnalysisFactPack,
    qualityWarnings: AnalysisQualityWarning[],
  ) {
    const trend = factPack.trends[0];
    const ranking = factPack.rankings[0];
    const anomaly = factPack.anomalies[0];

    return [
      `## ${primarySheet.sheetName} Analysis Overview`,
      '',
      `- Rows: ${primarySheet.rowCount}`,
      `- Columns: ${primarySheet.columnCount}`,
      `- Confidence: ${primarySheet.confidence.toFixed(2)}`,
      trend ? `- Trend: ${trend.metric} over ${trend.points.length} period(s)` : '- Trend: N/A',
      ranking ? `- Breakdown: ${ranking.dimension} (${ranking.items.length} group(s))` : '- Breakdown: N/A',
      anomaly ? `- Anomaly: ${anomaly.label}` : '- Anomaly: N/A',
      qualityWarnings.length > 0 ? `- Quality: ${qualityWarnings[0].message}` : '- Quality: OK',
    ].join('\n');
  }

  private buildChartData(
    sheet: WorkbookAnalysisSheetProfile,
    chartType: 'bar' | 'line' | 'pie' | 'scatter',
    xAxisField: string,
    yAxisField: string,
    dimensionField?: string | null,
  ): ChartContext['chartData'] {
    if (chartType === 'line') {
      const trend = this.buildTrend(sheet, xAxisField, yAxisField);
      return {
        sourceKind: 'trend',
        labels: trend.points.map((point) => point.period),
        values: trend.points.map((point) => point.value),
        points: trend.points.map((point) => ({
          label: point.period,
          value: point.value,
        })),
      };
    }

    if (chartType === 'bar' || chartType === 'pie') {
      const ranking = this.buildRanking(sheet, xAxisField || dimensionField || sheet.headers[0] || 'Category', yAxisField);
      return {
        sourceKind: 'ranking',
        labels: ranking.items.map((item) => item.label),
        values: ranking.items.map((item) => item.value),
        points: ranking.items.map((item) => ({
          label: item.label,
          value: item.value,
        })),
      };
    }

    if (chartType === 'scatter') {
      const xIndex = this.getFieldIndex(sheet.headers, xAxisField);
      const yIndex = this.getFieldIndex(sheet.headers, yAxisField);
      const labelIndex =
        this.getFieldIndex(sheet.headers, dimensionField ?? '') >= 0
          ? this.getFieldIndex(sheet.headers, dimensionField ?? '')
          : 0;
      const points = sheet.dataRows
        .map((row, index) => ({
          label: this.normalizeScatterLabel(row[labelIndex], index),
          x: this.toNumber(row[xIndex]),
          y: this.toNumber(row[yIndex]),
        }))
        .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
        .slice(0, 24);

      return {
        sourceKind: 'scatter',
        points,
      };
    }

    const xIndex = this.getFieldIndex(sheet.headers, xAxisField);
    const yIndex = this.getFieldIndex(sheet.headers, yAxisField);
    const points = sheet.dataRows
      .map((row) => ({
        label: String(row[xIndex] ?? '').trim(),
        value: this.toNumber(row[yIndex]),
      }))
      .filter((point) => point.label)
      .slice(0, 8);

    return {
      sourceKind: 'raw',
      labels: points.map((point) => point.label),
      values: points.map((point) => point.value),
      points,
    };
  }

  private buildFactPack(
    primarySheet: WorkbookAnalysisSheetProfile,
    selectedSheets: WorkbookAnalysisSheetProfile[],
    prompt: string,
  ): AnalysisFactPack {
    const timeField = this.findTimeField(primarySheet.fieldProfiles);
    const metricField = this.findMetricField(primarySheet.fieldProfiles);
    const dimensionField = this.findDimensionField(primarySheet.fieldProfiles);
    const totals = this.buildTotals(primarySheet, metricField);
    const trends = timeField && metricField ? [this.buildTrend(primarySheet, timeField, metricField)] : [];
    const rankings =
      dimensionField && metricField ? [this.buildRanking(primarySheet, dimensionField, metricField)] : [];
    const anomalies = metricField ? this.buildAnomalies(primarySheet, metricField) : [];

    if (selectedSheets.length > 1) {
      totals.__sheetCount = selectedSheets.length;
    }

    if (prompt.toLowerCase().includes('region') && dimensionField && metricField && rankings.length === 0) {
      rankings.push(this.buildRanking(primarySheet, dimensionField, metricField));
    }

    return {
      totals,
      trends,
      rankings,
      anomalies,
    };
  }

  private buildQualityWarnings(
    primarySheet: WorkbookAnalysisSheetProfile,
    selectedSheets: WorkbookAnalysisSheetProfile[],
    factPack: AnalysisFactPack,
  ): AnalysisQualityWarning[] {
    const warnings: AnalysisQualityWarning[] = [];
    warnings.push(
      ...primarySheet.qualityProfile.warnings.map((message) => ({
        type: 'quality' as const,
        level: 'warning' as const,
        message,
        sheetName: primarySheet.sheetName,
      })),
    );

    if (primarySheet.rowCount === 0) {
      warnings.push({
        type: 'coverage',
        level: 'critical',
        message: 'No usable data rows were detected in the primary sheet.',
        sheetName: primarySheet.sheetName,
      });
    }

    if (factPack.trends.length === 0) {
      warnings.push({
        type: 'confidence',
        level: 'info',
        message: 'No clear time field was detected, so trend analysis was skipped.',
        sheetName: primarySheet.sheetName,
      });
    }

    if (selectedSheets.length > 1) {
      warnings.push({
        type: 'coverage',
        level: 'info',
        message: `Multiple candidate sheets were found; analysis focused on ${primarySheet.sheetName}.`,
      });
    }

    return warnings;
  }

  private buildFollowupSuggestions(
    primarySheet: WorkbookAnalysisSheetProfile,
    factPack: AnalysisFactPack,
    qualityWarnings: AnalysisQualityWarning[],
  ) {
    const suggestions = new Set<string>();
    if (factPack.trends.length > 0) {
      suggestions.add('Create a monthly trend chart');
    }
    if (factPack.rankings.length > 0) {
      suggestions.add('Compare top and bottom groups by region');
    }
    if (factPack.anomalies.length > 0) {
      suggestions.add('Inspect outliers and validate source data');
    }
    if (qualityWarnings.some((warning) => warning.type === 'quality')) {
      suggestions.add('Fix sheet quality issues before relying on this analysis');
    }
    if (primarySheet.fieldProfiles.some((field) => field.semanticRole === 'metric')) {
      suggestions.add('Generate a charts summary for the same dataset');
    }
    return Array.from(suggestions).slice(0, 5);
  }

  private computeConfidence(
    primarySheet: WorkbookAnalysisSheetProfile,
    selectedSheets: WorkbookAnalysisSheetProfile[],
    qualityWarnings: AnalysisQualityWarning[],
  ) {
    let score = primarySheet.confidence;
    score -= qualityWarnings.filter((warning) => warning.level === 'warning' || warning.level === 'critical').length * 0.05;
    score += selectedSheets.length > 1 ? 0.02 : 0;
    return Math.max(0.35, Math.min(0.98, Number(score.toFixed(4))));
  }

  private buildWorkbookQuality(sheets: WorkbookAnalysisSheetProfile[]): WorkbookAnalysisWorkbookQuality {
    const warnings: string[] = [];
    const hasEmptySummarySheet = sheets.some((sheet) => {
      const lower = sheet.sheetName.toLowerCase();
      return lower.includes('summary') && sheet.qualityProfile.blankRowRatio > 0.6;
    });

    const hasMergedLayoutRisk = sheets.some((sheet) => sheet.headers.length <= 1 && sheet.rowCount > 10);
    if (hasEmptySummarySheet) {
      warnings.push('Summary sheet appears incomplete or empty.');
    }
    if (hasMergedLayoutRisk) {
      warnings.push('Some sheets may use heavily merged or layout-oriented formatting.');
    }

    return {
      hasMergedLayoutRisk,
      hasEmptySummarySheet,
      warnings,
    };
  }

  private buildCandidateDatasets(sheets: WorkbookAnalysisSheetProfile[]): WorkbookAnalysisCandidateDataset[] {
    return sheets
      .filter((sheet) => sheet.rowCount > 0 && sheet.headers.length > 0)
      .slice()
      .sort((left, right) => right.confidence - left.confidence)
      .slice(0, 3)
      .map((sheet) => ({
        sheetName: sheet.sheetName,
        regionId: sheet.tableRegions[0]?.regionId ?? `${sheet.sheetName}-region-1`,
        confidence: sheet.confidence,
      }));
  }

  private selectSheets(
    sheets: WorkbookAnalysisSheetProfile[],
    requestedSheetNames?: string[],
  ) {
    if (!requestedSheetNames || requestedSheetNames.length === 0) {
      return sheets.filter((sheet) => sheet.isPrimary).slice(0, 1);
    }

    const normalizedRequested = requestedSheetNames.map((name) => name.trim().toLowerCase()).filter(Boolean);
    const selected = sheets.filter((sheet) =>
      normalizedRequested.includes(sheet.sheetName.trim().toLowerCase()),
    );
    return selected.length > 0 ? selected : sheets.filter((sheet) => sheet.isPrimary).slice(0, 1);
  }

  private pickPrimarySheet(sheets: WorkbookAnalysisSheetProfile[]) {
    return (
      sheets
        .slice()
        .sort((left, right) => right.confidence - left.confidence || right.rowCount - left.rowCount)[0] ?? null
    );
  }

  private buildTotals(sheet: WorkbookAnalysisSheetProfile, metricField?: string | null) {
    if (!metricField) {
      return {};
    }

    const metricIndex = this.getFieldIndex(sheet.headers, metricField);
    if (metricIndex < 0) {
      return {};
    }

    const total = sheet.dataRows.reduce((sum, row) => sum + this.toNumber(row[metricIndex]), 0);
    return { [metricField]: Number(total.toFixed(2)) };
  }

  private buildTrend(
    sheet: WorkbookAnalysisSheetProfile,
    timeField: string,
    metricField: string,
  ) {
    const timeIndex = this.getFieldIndex(sheet.headers, timeField);
    const metricIndex = this.getFieldIndex(sheet.headers, metricField);
    const buckets = new Map<string, number>();

    for (const row of sheet.dataRows) {
      const period = this.normalizeTimeBucket(row[timeIndex]);
      if (!period) {
        continue;
      }
      buckets.set(period, (buckets.get(period) ?? 0) + this.toNumber(row[metricIndex]));
    }

    const points = Array.from(buckets.entries())
      .sort((left, right) => this.comparePeriod(left[0], right[0]))
      .map(([period, value]) => ({ period, value: Number(value.toFixed(2)) }));

    return {
      metric: metricField,
      grain: 'time',
      points,
    };
  }

  private buildRanking(
    sheet: WorkbookAnalysisSheetProfile,
    dimensionField: string,
    metricField: string,
  ) {
    const dimensionIndex = this.getFieldIndex(sheet.headers, dimensionField);
    const metricIndex = this.getFieldIndex(sheet.headers, metricField);
    const groups = new Map<string, number>();

    for (const row of sheet.dataRows) {
      const label = this.normalizeLabel(row[dimensionIndex]);
      if (!label) {
        continue;
      }
      groups.set(label, (groups.get(label) ?? 0) + this.toNumber(row[metricIndex]));
    }

    const items = Array.from(groups.entries())
      .sort((left, right) => right[1] - left[1])
      .slice(0, 8)
      .map(([label, value]) => ({ label, value: Number(value.toFixed(2)) }));

    return {
      dimension: dimensionField,
      items,
    };
  }

  private buildChartTitle(
    chartType: 'bar' | 'line' | 'pie' | 'scatter',
    xAxisField: string,
    yAxisField: string,
    prompt: string,
  ) {
    const normalizedPrompt = prompt.trim();
    if (normalizedPrompt.length > 0) {
      const firstSentence = normalizedPrompt.split(/[.!?。！？]/)[0]?.trim();
      if (firstSentence) {
        return firstSentence;
      }
    }

    if (chartType === 'pie') {
      return `${yAxisField} share by ${xAxisField}`;
    }
    if (chartType === 'scatter') {
      return `${yAxisField} vs ${xAxisField}`;
    }
    return `${yAxisField} by ${xAxisField}`;
  }

  private buildAnomalies(sheet: WorkbookAnalysisSheetProfile, metricField: string) {
    const metricIndex = this.getFieldIndex(sheet.headers, metricField);
    const values = sheet.dataRows
      .map((row) => this.toNumber(row[metricIndex]))
      .filter((value) => Number.isFinite(value));
    if (values.length < 4) {
      return [];
    }

    const q1 = this.percentile(values, 0.25);
    const q3 = this.percentile(values, 0.75);
    const iqr = q3 - q1;
    const lower = q1 - 1.5 * iqr;
    const upper = q3 + 1.5 * iqr;

    return sheet.dataRows
      .map((row) => {
        const actual = this.toNumber(row[metricIndex]);
        return {
          label: this.normalizeLabel(row[0]) || sheet.sheetName,
          actual,
          deviationPct: null as number | null,
          reason: actual < lower || actual > upper ? 'Outside IQR range' : null,
        };
      })
      .filter((item) => item.reason !== null)
      .slice(0, 5)
      .map((item) => ({
        metric: metricField,
        label: item.label,
        actual: Number(item.actual.toFixed(2)),
        deviationPct: item.deviationPct,
        reason: item.reason,
      }));
  }

  private buildFieldProfiles(headers: string[], dataRows: RawSheetMatrix) {
    return headers.map((header, index) => {
      const values = dataRows.map((row) => row[index] ?? '').filter((value) => String(value).trim().length > 0);
      const nonNullRatio = dataRows.length > 0 ? values.length / dataRows.length : 0;
      const distinctCount = new Set(values.map((value) => this.normalizeLabel(value))).size;
      const numericValues = values.map((value) => this.tryParseNumber(value)).filter((value): value is number => value !== null);
      const dateLikeCount = values.filter((value) => this.looksLikeDate(value)).length;
      const booleanCount = values.filter((value) => /^(true|false)$/i.test(String(value).trim())).length;
      const numericRatio = values.length > 0 ? numericValues.length / values.length : 0;
      const dateRatio = values.length > 0 ? dateLikeCount / values.length : 0;
      const booleanRatio = values.length > 0 ? booleanCount / values.length : 0;
      const dataType = this.inferDataType(numericRatio, dateRatio, booleanRatio, values);
      const semanticRole = this.inferSemanticRole(header, values, dataType, distinctCount, dataRows.length);
      const exampleValues = Array.from(new Set(values.map((value) => String(value).trim()).filter(Boolean))).slice(0, 3);
      const min = numericValues.length > 0 ? Math.min(...numericValues) : null;
      const max = numericValues.length > 0 ? Math.max(...numericValues) : null;
      const mean = numericValues.length > 0 ? numericValues.reduce((sum, value) => sum + value, 0) / numericValues.length : null;

      return {
        fieldName: header,
        normalizedFieldName: this.normalizeLabel(header),
        dataType,
        semanticRole,
        nonNullRatio: Number(nonNullRatio.toFixed(4)),
        distinctCount,
        exampleValues,
        min,
        max,
        mean: mean === null ? null : Number(mean.toFixed(2)),
        currencyHint: this.inferCurrencyHint(header),
      };
    });
  }

  private buildQualityProfile(
    headers: string[],
    dataRows: RawSheetMatrix,
    fieldProfiles: WorkbookAnalysisFieldProfile[],
  ): WorkbookAnalysisQualityProfile {
    const blankRowCount = dataRows.filter((row) => this.isBlankRow(row)).length;
    const seenRows = new Set<string>();
    let duplicateRowCount = 0;
    for (const row of dataRows) {
      const signature = JSON.stringify(row.map((value) => this.normalizeLabel(value)));
      if (seenRows.has(signature)) {
        duplicateRowCount += 1;
      } else {
        seenRows.add(signature);
      }
    }

    const invalidDateColumns = fieldProfiles
      .filter((field) => field.semanticRole === 'time' && field.dataType !== 'date')
      .map((field) => field.fieldName);
    const numericPollutionColumns = fieldProfiles
      .filter((field) => field.semanticRole === 'metric' && field.dataType !== 'number')
      .map((field) => field.fieldName);

    const warnings: string[] = [];
    if (headers.length === 0) {
      warnings.push('Sheet has no detectable headers.');
    }
    if (duplicateRowCount > 0) {
      warnings.push(`Detected ${duplicateRowCount} duplicate data row(s).`);
    }
    if (blankRowCount > 0 && dataRows.length > 0) {
      warnings.push(`Detected ${blankRowCount} blank data row(s).`);
    }
    if (invalidDateColumns.length > 0) {
      warnings.push(`Potential date parsing issues in columns: ${invalidDateColumns.join(', ')}`);
    }
    if (numericPollutionColumns.length > 0) {
      warnings.push(`Potential numeric pollution in columns: ${numericPollutionColumns.join(', ')}`);
    }

    return {
      blankRowRatio: dataRows.length > 0 ? Number((blankRowCount / dataRows.length).toFixed(4)) : 0,
      duplicateRowCount,
      invalidDateColumns,
      numericPollutionColumns,
      warnings,
    };
  }

  private readWorkbook(source: WorkbookSource) {
    if (source.buffer) {
      return XLSX.read(source.buffer, {
        type: 'buffer',
        cellDates: true,
        raw: false,
      });
    }

    if (source.filePath) {
      return XLSX.readFile(source.filePath, {
        cellDates: true,
        raw: false,
      });
    }

    throw new BadRequestException('Workbook source is missing');
  }

  private readSheetRows(worksheet: XLSX.WorkSheet) {
    const rows = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      raw: false,
      blankrows: false,
      defval: '',
    }) as unknown[][];

    return rows.map((row) => (Array.isArray(row) ? row.map((cell) => this.toCellValue(cell)) : []));
  }

  private detectHeaderRowIndex(rows: RawSheetMatrix) {
    let bestIndex = 0;
    let bestScore = -1;
    const limit = Math.min(rows.length, 10);

    for (let index = 0; index < limit; index += 1) {
      const row = rows[index] ?? [];
      const nonEmptyCount = row.filter((value) => String(value).trim().length > 0).length;
      if (nonEmptyCount === 0) {
        continue;
      }
      const textCount = row.filter((value) => this.looksLikeText(value)).length;
      const score = nonEmptyCount + textCount * 0.75;
      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    }

    return bestIndex;
  }

  private buildHeaders(headerRow: string[], columnCount: number) {
    const headers: string[] = [];
    const duplicates = new Map<string, number>();

    for (let columnIndex = 0; columnIndex < Math.max(columnCount, headerRow.length); columnIndex += 1) {
      let header = String(headerRow[columnIndex] ?? '').trim();
      if (!header) {
        header = `Column${columnIndex + 1}`;
      }

      const normalized = this.normalizeLabel(header);
      const duplicateCount = (duplicates.get(normalized) ?? 0) + 1;
      duplicates.set(normalized, duplicateCount);
      if (duplicateCount > 1) {
        header = `${header}_${duplicateCount}`;
      }

      headers.push(header);
    }

    return headers;
  }

  private buildRange(headerRowIndex: number, rowCount: number, columnCount: number) {
    const lastRowIndex = Math.max(headerRowIndex, headerRowIndex + rowCount);
    const lastColumn = Math.max(0, columnCount - 1);
    return `A${headerRowIndex + 1}:${this.toColumnLabel(lastColumn)}${lastRowIndex + 1}`;
  }

  private computeRegionConfidence(headers: string[], dataRows: RawSheetMatrix) {
    if (headers.length === 0 || dataRows.length === 0) {
      return 0.25;
    }
    const textHeaderRatio = headers.filter((header) => this.looksLikeText(header)).length / headers.length;
    const nonEmptyRatio = dataRows.filter((row) => !this.isBlankRow(row)).length / dataRows.length;
    return Number(Math.max(0.3, Math.min(0.98, 0.55 + textHeaderRatio * 0.2 + nonEmptyRatio * 0.2)).toFixed(4));
  }

  private inferDataType(
    numericRatio: number,
    dateRatio: number,
    booleanRatio: number,
    values: string[],
  ): 'string' | 'number' | 'date' | 'boolean' | 'mixed' {
    if (dateRatio >= 0.8) {
      return 'date';
    }
    if (numericRatio >= 0.8) {
      return 'number';
    }
    if (booleanRatio >= 0.8) {
      return 'boolean';
    }
    if (numericRatio >= 0.5 || dateRatio >= 0.5 || booleanRatio >= 0.5) {
      return 'mixed';
    }
    return values.length === 0 ? 'string' : 'string';
  }

  private inferSemanticRole(
    header: string,
    values: string[],
    dataType: 'string' | 'number' | 'date' | 'boolean' | 'mixed',
    distinctCount: number,
    rowCount: number,
  ): WorkbookAnalysisFieldProfile['semanticRole'] {
    const normalizedHeader = this.normalizeLabel(header);
    if (this.looksLikeTimeField(normalizedHeader, values, dataType)) {
      return 'time';
    }
    if (this.looksLikeIdField(normalizedHeader)) {
      return 'id';
    }
    if (dataType === 'number' && this.looksLikeMetricField(normalizedHeader)) {
      return 'metric';
    }
    if (dataType === 'number' && distinctCount > Math.max(3, Math.round(rowCount * 0.2))) {
      return 'metric';
    }
    if (distinctCount <= Math.max(5, Math.round(rowCount * 0.15))) {
      return 'dimension';
    }
    if (dataType === 'string') {
      return this.looksLikeMetricField(normalizedHeader) ? 'metric' : 'category';
    }
    return 'text_note';
  }

  private looksLikeTimeField(normalizedHeader: string, values: string[], dataType: string) {
    return (
      /(^|_)(date|month|time|year|week|day)(_|$)/.test(normalizedHeader) ||
      dataType === 'date' ||
      values.some((value) => this.looksLikeDate(value))
    );
  }

  private looksLikeMetricField(normalizedHeader: string) {
    return /(^|_)(revenue|sales|profit|cost|amount|total|price|margin|qty|quantity|volume|score|count)(_|$)/.test(normalizedHeader);
  }

  private looksLikeIdField(normalizedHeader: string) {
    return /(^|_)(id|code|uuid|order|account|customer|product)(_|$)/.test(normalizedHeader);
  }

  private inferCurrencyHint(header: string) {
    const normalized = this.normalizeLabel(header);
    if (normalized.includes('usd') || normalized.includes('dollar') || normalized.includes('revenue') || normalized.includes('profit') || normalized.includes('sales')) {
      return 'USD';
    }
    return null;
  }

  private findTimeField(fieldProfiles: WorkbookAnalysisFieldProfile[]) {
    return fieldProfiles.find((field) => field.semanticRole === 'time')?.fieldName ?? null;
  }

  private findMetricField(fieldProfiles: WorkbookAnalysisFieldProfile[]) {
    return fieldProfiles.find((field) => field.semanticRole === 'metric')?.fieldName ?? null;
  }

  private findDimensionField(fieldProfiles: WorkbookAnalysisFieldProfile[]) {
    return fieldProfiles.find((field) => field.semanticRole === 'dimension' || field.semanticRole === 'category')?.fieldName ?? null;
  }

  private findScatterFields(fieldProfiles: WorkbookAnalysisFieldProfile[]) {
    const numericFields = fieldProfiles.filter((field) => field.dataType === 'number');
    if (numericFields.length < 2) {
      return null;
    }
    return {
      xField: numericFields[0].fieldName,
      yField: numericFields[1].fieldName,
    };
  }

  private resolveChartType(
    preferredChartType: 'bar' | 'line' | 'pie' | 'scatter',
    prompt: string,
    timeField: string | null,
    metricField: string | null,
    fieldProfiles: WorkbookAnalysisFieldProfile[],
  ) {
    const normalizedPrompt = prompt.toLowerCase();
    if (normalizedPrompt.includes('pie') || normalizedPrompt.includes('share') || normalizedPrompt.includes('composition')) {
      return 'pie' as const;
    }
    if (normalizedPrompt.includes('scatter')) {
      return 'scatter' as const;
    }
    if (normalizedPrompt.includes('trend') || normalizedPrompt.includes('over time') || normalizedPrompt.includes('timeline')) {
      return 'line' as const;
    }
    if (preferredChartType === 'scatter' && this.findScatterFields(fieldProfiles)) {
      return 'scatter' as const;
    }
    if (timeField && metricField) {
      return preferredChartType === 'pie' ? 'line' : preferredChartType === 'scatter' ? 'line' : preferredChartType;
    }
    if (preferredChartType === 'pie' || preferredChartType === 'bar') {
      return preferredChartType;
    }
    return metricField ? 'bar' : 'line';
  }

  private getFieldIndex(headers: string[], fieldName: string) {
    const normalized = this.normalizeLabel(fieldName);
    return headers.findIndex((header) => this.normalizeLabel(header) === normalized);
  }

  private normalizeTimeBucket(value: string) {
    const normalized = String(value ?? '').trim();
    if (!normalized) {
      return '';
    }

    const yyyymm = normalized.match(/^(\d{4})[-/](\d{1,2})$/);
    if (yyyymm) {
      return `${yyyymm[1]}-${String(Number(yyyymm[2])).padStart(2, '0')}`;
    }

    const yearOnly = normalized.match(/^(\d{4})$/);
    if (yearOnly) {
      return yearOnly[1];
    }

    const date = new Date(normalized);
    if (!Number.isNaN(date.getTime())) {
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    }

    return normalized;
  }

  private comparePeriod(left: string, right: string) {
    return left.localeCompare(right);
  }

  private normalizeLabel(value: unknown) {
    return String(value ?? '').trim().toLowerCase();
  }

  private normalizeScatterLabel(value: unknown, index: number) {
    const label = String(value ?? '').trim();
    return label || `Point ${index + 1}`;
  }

  private looksLikeText(value: unknown) {
    const text = String(value ?? '').trim();
    if (!text) {
      return false;
    }
    return /[a-zA-Z\u4e00-\u9fa5]/.test(text);
  }

  private looksLikeDate(value: unknown) {
    const text = String(value ?? '').trim();
    if (!text) {
      return false;
    }
    if (/^\d{4}[-/]\d{1,2}([-/]\d{1,2})?$/.test(text)) {
      return true;
    }
    if (/^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}$/.test(text)) {
      return true;
    }
    return !Number.isNaN(Date.parse(text));
  }

  private isBlankRow(row: string[]) {
    return row.every((value) => String(value ?? '').trim().length === 0);
  }

  private toNumber(value: unknown) {
    const parsed = this.tryParseNumber(value);
    return parsed ?? 0;
  }

  private tryParseNumber(value: unknown) {
    if (value === null || value === undefined) {
      return null;
    }
    const normalized = String(value).replace(/,/g, '').replace(/[%$¥€£]/g, '').trim();
    if (!normalized) {
      return null;
    }
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private percentile(values: number[], fraction: number) {
    const sorted = values.slice().sort((left, right) => left - right);
    if (sorted.length === 0) {
      return 0;
    }
    const index = (sorted.length - 1) * fraction;
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    if (lower === upper) {
      return sorted[lower];
    }
    return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
  }

  private sanitizeId(value: string) {
    return value.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'sheet';
  }

  private toColumnLabel(columnIndex: number) {
    let index = columnIndex;
    let label = '';
    while (index >= 0) {
      label = String.fromCharCode((index % 26) + 65) + label;
      index = Math.floor(index / 26) - 1;
    }
    return label;
  }

  private toCellValue(cell: unknown) {
    if (cell === null || cell === undefined) {
      return '';
    }
    if (cell instanceof Date) {
      return cell.toISOString();
    }
    return String(cell);
  }
}

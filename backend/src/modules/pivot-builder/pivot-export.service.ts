import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { access, mkdir, stat } from 'node:fs/promises';
import { dirname, extname, resolve } from 'node:path';
import * as XLSX from 'xlsx';
import { PivotNativeExportClient } from './pivot-native-export.client';
import type {
  PivotConfig,
  PivotExportInput,
  PivotExportMode,
  PivotFilterConfig,
  PivotResolvedExport,
  PivotValueConfig,
} from './pivot-export.types';

@Injectable()
export class PivotExportService {
  private readonly logger = new Logger(PivotExportService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly pivotNativeExportClient: PivotNativeExportClient,
  ) {}

  async createPivotExport(input: PivotExportInput): Promise<PivotResolvedExport> {
    const mode = this.getExportMode();
    if (mode === 'java_native') {
      this.logger.log(`Using java_native pivot export for job ${input.jobId}`);
      return this.createJavaNativeExport(input);
    }

    return this.createNodeSummaryExport(input);
  }

  getExportMode(): PivotExportMode {
    const mode = (this.configService.get<string>('PIVOT_EXPORT_MODE') ?? 'node_summary').trim();
    return mode === 'java_native' ? 'java_native' : 'node_summary';
  }

  getExportFilePath(jobId: string, exportFileName: string) {
    return resolve(this.getExportStorageRoot(), jobId, this.normalizeExportFileName(exportFileName));
  }

  async ensureExportExists(jobId: string, exportFileName: string) {
    const exportFilePath = this.getExportFilePath(jobId, exportFileName);
    await this.ensureSourceFile(exportFilePath);
    return exportFilePath;
  }

  private async createNodeSummaryExport(input: PivotExportInput): Promise<PivotResolvedExport> {
    if (!input.workbook.localFilePath) {
      throw new BadRequestException('Workbook source file is unavailable');
    }

    await this.ensureSourceFile(input.workbook.localFilePath);

    const sourceWorkbook = XLSX.readFile(input.workbook.localFilePath, {
      cellDates: true,
      raw: false,
    });
    const selectedSheetName =
      sourceWorkbook.SheetNames.includes(input.sheetName) ? input.sheetName : sourceWorkbook.SheetNames[0];
    const worksheet = sourceWorkbook.Sheets[selectedSheetName];
    if (!worksheet) {
      throw new NotFoundException('Selected sheet not found');
    }

    const rows = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      raw: false,
      blankrows: false,
      defval: '',
    }) as unknown[][];
    const headers = (rows[0] ?? []).map((value) => this.normalizeCell(value)).filter(Boolean);
    const dataRows = rows
      .slice(1)
      .map((row) => (Array.isArray(row) ? row.map((value) => this.normalizeCell(value)) : []))
      .filter((row) => row.some((cell) => cell.trim().length > 0));

    if (headers.length === 0 || dataRows.length === 0) {
      throw new BadRequestException('Workbook sheet has no pivotable data');
    }

    const pivotConfig = this.normalizeConfig(input.config, headers);
    const pivot = this.buildPivotTable(headers, dataRows, pivotConfig);
    const exportFileName = this.buildExportFileName(input.workbook.fileName);
    const exportFilePath = this.getExportFilePath(input.jobId, exportFileName);

    await mkdir(dirname(exportFilePath), { recursive: true });

    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet(pivot.rows);
    sheet['!cols'] = this.buildColumnWidths(pivot.rows);
    XLSX.utils.book_append_sheet(workbook, sheet, 'Pivot');
    XLSX.writeFile(workbook, exportFilePath, { bookType: 'xlsx' });
    const exportStats = await stat(exportFilePath);

    return {
      exportFileName,
      exportFilePath,
      exportFileUrl: `/api/pivot-builder/${input.jobId}/download`,
      exportFileSizeBytes: Number(exportStats.size),
      sheetName: selectedSheetName,
    };
  }

  private async createJavaNativeExport(input: PivotExportInput): Promise<PivotResolvedExport> {
    if (!input.workbook.localFilePath) {
      throw new BadRequestException('Workbook source file is unavailable');
    }

    await this.ensureSourceFile(input.workbook.localFilePath);

    const exportFileName = this.buildExportFileName(input.workbook.fileName);
    const nativeExport = await this.pivotNativeExportClient.exportPivot({
      jobId: input.jobId,
      userId: input.userId,
      sourceFilePath: input.workbook.localFilePath,
      sourceFileName: input.workbook.fileName,
      sourceSheetName: input.sheetName,
      outputFileName: exportFileName,
      pivotConfig: input.config,
    });

    return {
      exportFileName: this.normalizeExportFileName(nativeExport.exportFileName),
      exportFilePath: nativeExport.exportFilePath,
      exportFileUrl: `/api/pivot-builder/${input.jobId}/download`,
      exportFileSizeBytes: nativeExport.fileSizeBytes,
      sheetName: nativeExport.sheetName,
    };
  }

  private buildPivotTable(
    headers: string[],
    dataRows: string[][],
    config: Required<PivotConfig>,
  ) {
    const rowFields = config.rows.length > 0 ? config.rows : [headers[0] ?? 'Group'];
    const columnFields = config.columns;
    const valueConfig = config.values[0] ?? {
      field: headers[1] ?? headers[0] ?? 'Value',
      aggregation: 'sum',
    };
    const filters = config.filters;

    const rowKeys: string[] = [];
    const rowLabels = new Map<string, string[]>();
    const columnKeys: string[] = [];
    const columnLabels = new Map<string, string[]>();
    const stats = new Map<string, Map<string, { sum: number; count: number; min: number | null; max: number | null }>>();
    const fallbackColumnKey = '__all__';

    for (const row of dataRows) {
      if (!this.passesFilters(headers, row, filters)) {
        continue;
      }

      const rowValues = rowFields.map((field) => this.readCell(headers, row, field));
      const columnValues = columnFields.map((field) => this.readCell(headers, row, field));
      const rowKey = JSON.stringify(rowValues);
      const columnKey = columnFields.length > 0 ? JSON.stringify(columnValues) : fallbackColumnKey;

      if (!rowLabels.has(rowKey)) {
        rowLabels.set(rowKey, rowValues);
        rowKeys.push(rowKey);
      }

      if (!columnLabels.has(columnKey)) {
        columnLabels.set(columnKey, columnValues);
        if (columnKey !== fallbackColumnKey) {
          columnKeys.push(columnKey);
        }
      }

      const value = this.toNumericValue(this.readCell(headers, row, valueConfig.field));
      const rowStats = stats.get(rowKey) ?? new Map();
      stats.set(rowKey, rowStats);
      const current = rowStats.get(columnKey) ?? { sum: 0, count: 0, min: null, max: null };

      if (valueConfig.aggregation === 'count') {
        current.count += 1;
      } else {
        current.sum += value;
        current.count += 1;
        current.min = current.min === null ? value : Math.min(current.min, value);
        current.max = current.max === null ? value : Math.max(current.max, value);
      }

      rowStats.set(columnKey, current);
    }

    if (rowKeys.length === 0) {
      throw new BadRequestException('Pivot builder could not find matching rows');
    }

    const measureLabel = `${valueConfig.field} (${valueConfig.aggregation})`;
    const headerRow = [
      ...rowFields,
      ...(columnFields.length > 0
        ? columnKeys.map((columnKey) => this.formatGroup(columnLabels.get(columnKey) ?? []))
        : [measureLabel]),
    ];

    const tableRows: Array<Array<string | number>> = [headerRow];
    for (const rowKey of rowKeys) {
      const rowValues = rowLabels.get(rowKey) ?? [];
      const rowStats = stats.get(rowKey) ?? new Map();
      const nextRow: Array<string | number> = [...rowValues];

      if (columnFields.length > 0) {
        for (const columnKey of columnKeys) {
          const cellStats = rowStats.get(columnKey);
          nextRow.push(this.resolveAggregatedValue(cellStats, valueConfig.aggregation));
        }
      } else {
        const cellStats = rowStats.get(fallbackColumnKey);
        nextRow.push(this.resolveAggregatedValue(cellStats, valueConfig.aggregation));
      }

      tableRows.push(nextRow);
    }

    return {
      rows: tableRows,
      rowCount: tableRows.length - 1,
      columnCount: headerRow.length,
    };
  }

  private resolveAggregatedValue(
    stats: { sum: number; count: number; min: number | null; max: number | null } | undefined,
    aggregation: PivotValueConfig['aggregation'],
  ) {
    if (!stats) {
      return 0;
    }

    if (aggregation === 'count') {
      return stats.count;
    }

    if (aggregation === 'avg') {
      return stats.count > 0 ? Number((stats.sum / stats.count).toFixed(2)) : 0;
    }

    if (aggregation === 'min') {
      return stats.min ?? 0;
    }

    if (aggregation === 'max') {
      return stats.max ?? 0;
    }

    return Number(stats.sum.toFixed(2));
  }

  private normalizeConfig(config: PivotConfig, headers: string[]) {
    return {
      rows: this.normalizeFields(config.rows, headers, [headers[0] ?? 'Group']),
      columns: this.normalizeFields(config.columns, headers, []),
      values: this.normalizeValues(config.values, headers),
      filters: Array.isArray(config.filters) ? config.filters : [],
    };
  }

  private normalizeFields(values: string[] | undefined, headers: string[], fallback: string[]) {
    const normalized =
      values?.map((value) => this.resolveHeader(headers, value)).filter(Boolean) ?? [];
    return normalized.length > 0 ? normalized : fallback;
  }

  private normalizeValues(values: PivotValueConfig[] | undefined, headers: string[]) {
    const first = values?.[0];
    const field = first ? this.resolveHeader(headers, first.field) : headers[1] ?? headers[0] ?? 'Value';
    return [
      {
        field: field ?? headers[1] ?? headers[0] ?? 'Value',
        aggregation: first?.aggregation ?? 'sum',
      },
    ];
  }

  private passesFilters(headers: string[], row: string[], filters: PivotFilterConfig[]) {
    return filters.every((filter) => {
      const cell = this.readCell(headers, row, filter.field);
      const compare = filter.value;
      const numericCell = Number(cell);
      const numericCompare = Number(compare);

      switch (filter.operator) {
        case '!=':
        case '<>':
          return cell !== compare;
        case '>':
          return Number.isFinite(numericCell) && Number.isFinite(numericCompare)
            ? numericCell > numericCompare
            : cell > compare;
        case '>=':
          return Number.isFinite(numericCell) && Number.isFinite(numericCompare)
            ? numericCell >= numericCompare
            : cell >= compare;
        case '<':
          return Number.isFinite(numericCell) && Number.isFinite(numericCompare)
            ? numericCell < numericCompare
            : cell < compare;
        case '<=':
          return Number.isFinite(numericCell) && Number.isFinite(numericCompare)
            ? numericCell <= numericCompare
            : cell <= compare;
        case 'contains':
          return cell.includes(compare);
        case 'startsWith':
          return cell.startsWith(compare);
        case 'endsWith':
          return cell.endsWith(compare);
        case '=':
        case '==':
        default:
          return cell === compare;
      }
    });
  }

  private readCell(headers: string[], row: string[], field: string) {
    const index = this.resolveHeaderIndex(headers, field);
    return index >= 0 ? row[index] ?? '' : '';
  }

  private resolveHeader(headers: string[], field: string) {
    const index = this.resolveHeaderIndex(headers, field);
    return index >= 0 ? headers[index] : field;
  }

  private resolveHeaderIndex(headers: string[], field: string) {
    const normalized = field.trim().toLowerCase();
    return headers.findIndex((header) => header.trim().toLowerCase() === normalized);
  }

  private toNumericValue(value: string) {
    const parsed = Number(value.replace(/,/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private formatGroup(values: string[]) {
    return values.length > 0 ? values.join(' / ') : 'All';
  }

  private buildExportFileName(sourceFileName: string) {
    const baseName = sourceFileName.replace(extname(sourceFileName), '') || 'pivot';
    const safeBaseName = baseName.replace(/[\\/:*?"<>|\u0000-\u001F]+/g, '-').trim() || 'pivot';
    return `${safeBaseName}-pivot.xlsx`;
  }

  private normalizeExportFileName(exportFileName: string) {
    const baseName = exportFileName.replace(extname(exportFileName), '') || 'pivot';
    const safeBaseName = baseName.replace(/[\\/:*?"<>|\u0000-\u001F]+/g, '-').trim() || 'pivot';
    return `${safeBaseName}.xlsx`;
  }

  private getExportStorageRoot() {
    const configuredRoot = this.configService.get<string>('PIVOT_EXPORT_STORAGE_ROOT');
    if (configuredRoot && configuredRoot.trim().length > 0) {
      return configuredRoot;
    }
    return resolve(process.cwd(), 'storage', 'exports', 'pivot');
  }

  private buildColumnWidths(rows: Array<Array<string | number>>) {
    if (rows.length === 0) {
      return [];
    }

    const columnCount = Math.max(...rows.map((row) => row.length));
    return Array.from({ length: columnCount }, (_, columnIndex) => {
      const maxLength = rows.reduce((max, row) => {
        const value = row[columnIndex];
        const length = value === undefined || value === null ? 0 : String(value).length;
        return Math.max(max, length);
      }, 10);

      return { wch: Math.min(Math.max(maxLength + 2, 10), 48) };
    });
  }

  private normalizeCell(value: unknown) {
    if (value === null || value === undefined) {
      return '';
    }
    return String(value);
  }

  private async ensureSourceFile(filePath: string) {
    await access(filePath);
  }
}

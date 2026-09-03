import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import * as XLSX from 'xlsx';
import { PrismaService } from '../../prisma/prisma.service';
import { WorkbookAnalysisService } from '../workbook-analysis/workbook-analysis.service';

type UploadedWorkbookFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

type WorkbookSheetRecord = {
  id: string;
  sheetName: string;
  sheetIndex: number;
  headers: string[];
  sampleRows: string[][];
  rowCount: number;
  columnCount: number;
  summaryMd: string;
};

@Injectable()
export class FilesService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly workbookAnalysisService: WorkbookAnalysisService,
  ) {}

  async createWorkbookFromUpload(userId: string, file: UploadedWorkbookFile, plan: string) {
    this.assertSupportedFile(file);
    this.assertFileSize(file.size, plan);

    const parsed = this.workbookAnalysisService.analyzeWorkbookFromBuffer(
      file.buffer,
      file.originalname,
    );
    const fileType = this.getFileType(file.originalname);
    const objectKey = this.buildObjectKey(userId, file.originalname);
    await this.persistLocalUpload(objectKey, file.buffer);
    const workbook = await this.prismaService.workbook.create({
      data: {
        userId,
        originalFileName: file.originalname,
        fileType,
        mimeType: file.mimetype,
        objectKey,
        fileSizeBytes: BigInt(file.size),
        status: 'ready',
        sheetCount: parsed.workbook.sheetCount,
        rowCount: parsed.workbook.rowCount,
        columnCount: parsed.workbook.columnCount,
        summaryMd: parsed.workbook.summaryMd,
        summaryJson: parsed.workbook.summaryJson,
        parsedAt: new Date(),
        sheets: {
          create: parsed.sheets.map((sheet) => ({
            sheetName: sheet.sheetName,
            sheetIndex: sheet.sheetIndex,
            headerJson: sheet.headers,
            columnTypesJson: sheet.columnTypes,
            formulaColumnsJson: sheet.formulaColumns,
            sampleRowsJson: sheet.sampleRows,
            tableRegionsJson: sheet.tableRegions,
            fieldProfilesJson: sheet.fieldProfiles,
            qualityProfileJson: sheet.qualityProfile,
            summaryMd: sheet.summaryMd,
            rowCount: sheet.rowCount,
            columnCount: sheet.columnCount,
          })),
        },
      },
    });

    return this.toPublicWorkbook(workbook);
  }

  async listWorkbooks(userId: string) {
    const workbooks = await this.prismaService.workbook.findMany({
      where: { userId },
      orderBy: {
        uploadedAt: 'desc',
      },
    });
    return workbooks.map((workbook: (typeof workbooks)[number]) => this.toPublicWorkbook(workbook));
  }

  async getWorkbookPreview(id: string, userId: string) {
    const workbook = await this.prismaService.workbook.findFirst({
      where: {
        id,
        userId,
      },
      include: {
        sheets: {
          orderBy: {
            sheetIndex: 'asc',
          },
        },
      },
    });
    if (!workbook) {
      throw new NotFoundException('Workbook not found');
    }

    return {
      workbook: this.toPublicWorkbook(workbook),
      sheets: workbook.sheets.map((sheet: (typeof workbook.sheets)[number]) =>
        this.toPublicSheet(sheet),
      ),
    };
  }

  private parseWorkbook(file: UploadedWorkbookFile) {
    const workbook = XLSX.read(file.buffer, {
      type: 'buffer',
      cellDates: true,
      raw: false,
    });

    if (workbook.SheetNames.length === 0) {
      throw new BadRequestException('Workbook has no sheets');
    }

    const sheets: WorkbookSheetRecord[] = [];
    let totalRowCount = 0;
    let maxColumnCount = 0;

    workbook.SheetNames.forEach((sheetName, sheetIndex) => {
      const worksheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        raw: false,
        blankrows: false,
        defval: '',
      }) as unknown[][];

      const normalizedRows = rows.map((row) =>
        Array.isArray(row) ? row.map((cell) => this.toCellValue(cell)) : [],
      );
      const headers = (normalizedRows[0] ?? []).map((cell) => cell.trim()).filter(Boolean);
      const dataRows = normalizedRows.slice(1);
      const sampleRows = dataRows.slice(0, 5);
      const rowCount = dataRows.length;
      const columnCount = Math.max(headers.length, ...dataRows.map((row) => row.length), 0);

      totalRowCount += rowCount;
      maxColumnCount = Math.max(maxColumnCount, columnCount);

      sheets.push({
        id: `${file.originalname}_${sheetIndex + 1}`,
        sheetName,
        sheetIndex,
        headers,
        sampleRows,
        rowCount,
        columnCount,
        summaryMd: [
          `### ${sheetName}`,
          '',
          `- Rows: ${rowCount}`,
          `- Columns: ${columnCount}`,
          `- Headers: ${headers.length > 0 ? headers.join(', ') : 'N/A'}`,
        ].join('\n'),
      });
    });

    const summaryMd = [
      '## Workbook Summary',
      '',
      `- Sheets: ${workbook.SheetNames.length}`,
      `- Rows: ${totalRowCount}`,
      `- Columns: ${maxColumnCount}`,
      '',
      ...sheets.map((sheet) => sheet.summaryMd),
    ].join('\n');

    return {
      sheets,
      rowCount: totalRowCount,
      columnCount: maxColumnCount,
      summaryMd,
    };
  }

  private assertSupportedFile(file: UploadedWorkbookFile) {
    const fileType = this.getFileType(file.originalname);
    const supportedMimes = new Set([
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
      'application/csv',
      'text/plain',
      'application/octet-stream',
    ]);

    if (!fileType || !supportedMimes.has(file.mimetype)) {
      throw new BadRequestException('Unsupported workbook file');
    }
  }

  private assertFileSize(size: number, plan: string) {
    const maxSizeMap: Record<string, number> = {
      free: 5 * 1024 * 1024,
      pro: 50 * 1024 * 1024,
      pro_plus: 100 * 1024 * 1024,
    };

    const maxSize = maxSizeMap[plan] ?? maxSizeMap.free;
    if (size > maxSize) {
      throw new BadRequestException('File too large');
    }
  }

  private getFileType(fileName: string) {
    const extension = fileName.split('.').pop()?.toLowerCase();
    if (extension === 'xlsx' || extension === 'xls' || extension === 'csv') {
      return extension;
    }
    throw new BadRequestException('Unsupported workbook file');
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

  private buildObjectKey(userId: string, fileName: string) {
    return `local://uploads/${userId}/${Date.now()}-${fileName}`;
  }

  private async persistLocalUpload(objectKey: string, buffer: Buffer) {
    const localPath = this.toLocalStoragePath(objectKey);
    await mkdir(dirname(localPath), { recursive: true });
    await writeFile(localPath, buffer);
  }

  private toLocalStoragePath(objectKey: string) {
    const relativePath = objectKey.replace('local://', '').split('/').join('\\');
    return resolve(process.cwd(), 'storage', relativePath);
  }

  private toPublicSheet(sheet: {
    id: string;
    sheetName: string;
    sheetIndex: number;
    headerJson: unknown;
    columnTypesJson: unknown;
    formulaColumnsJson: unknown;
    sampleRowsJson: unknown;
    tableRegionsJson: unknown;
    fieldProfilesJson: unknown;
    qualityProfileJson: unknown;
    rowCount: number | null;
    columnCount: number | null;
  }) {
    return {
      id: sheet.id,
      sheetName: sheet.sheetName,
      sheetIndex: sheet.sheetIndex,
      headers: this.toStringArray(sheet.headerJson),
      columnTypes: this.toStringArray(sheet.columnTypesJson),
      formulaColumns: this.toStringArray(sheet.formulaColumnsJson),
      sampleRows: this.toMatrix(sheet.sampleRowsJson),
      tableRegions: this.toObjectArray(sheet.tableRegionsJson),
      fieldProfiles: this.toObjectArray(sheet.fieldProfilesJson),
      qualityProfile: this.toObjectRecord(sheet.qualityProfileJson),
      rowCount: sheet.rowCount ?? 0,
      columnCount: sheet.columnCount ?? 0,
    };
  }

  private toStringArray(value: unknown) {
    if (!Array.isArray(value)) {
      return [];
    }
    return value.map((item) => String(item));
  }

  private toMatrix(value: unknown) {
    if (!Array.isArray(value)) {
      return [];
    }
    return value.map((row) =>
      Array.isArray(row) ? row.map((cell) => String(cell)) : [],
    ) as string[][];
  }

  private toObjectArray(value: unknown) {
    if (!Array.isArray(value)) {
      return [];
    }
    return value.filter((item) => item && typeof item === 'object') as Record<string, unknown>[];
  }

  private toObjectRecord(value: unknown) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }
    return value as Record<string, unknown>;
  }

  private toPublicWorkbook(workbook: {
    id: string;
    userId: string;
    originalFileName: string;
    status: string;
    fileType: string;
    mimeType: string;
    objectKey: string;
    fileSizeBytes: bigint;
    sheetCount: number | null;
    rowCount: number | null;
    columnCount: number | null;
    summaryMd: string | null;
    uploadedAt: Date;
  }) {
    return {
      id: workbook.id,
      userId: workbook.userId,
      fileName: workbook.originalFileName,
      status: workbook.status,
      fileType: workbook.fileType,
      mimeType: workbook.mimeType,
      objectKey: workbook.objectKey,
      localFilePath: workbook.objectKey.startsWith('local://')
        ? this.toLocalStoragePath(workbook.objectKey)
        : undefined,
      fileSizeBytes: Number(workbook.fileSizeBytes),
      sheetCount: workbook.sheetCount ?? 0,
      rowCount: workbook.rowCount ?? 0,
      columnCount: workbook.columnCount ?? 0,
      summaryMd: workbook.summaryMd ?? '',
      uploadedAt: workbook.uploadedAt.toISOString(),
    };
  }
}

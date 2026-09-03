import {
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { PivotConfig } from './pivot-export.types';

type PivotNativeExportResponse = {
  success?: boolean;
  data?: {
    exportFileName?: string;
    exportFilePath?: string;
    sheetName?: string;
    fileSizeBytes?: number;
  };
  error?: {
    code?: string;
    message?: string;
  };
};

@Injectable()
export class PivotNativeExportClient {
  private readonly logger = new Logger(PivotNativeExportClient.name);

  constructor(private readonly configService: ConfigService) {}

  async exportPivot(input: {
    jobId: string;
    userId: string;
    sourceFilePath: string;
    sourceFileName: string;
    sourceSheetName: string;
    outputFileName: string;
    pivotConfig: PivotConfig;
  }) {
    const serviceUrl = (
      this.configService.get<string>('PIVOT_EXPORT_SERVICE_URL') ?? ''
    ).replace(/\/+$/, '');
    const sharedToken = this.configService.get<string>('PIVOT_EXPORT_SHARED_TOKEN') ?? '';
    const timeoutMs = this.readTimeoutMs();

    if (!serviceUrl || !sharedToken) {
      throw new ServiceUnavailableException(
        'Pivot native export service is not configured',
      );
    }

    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${serviceUrl}/internal/pivot/export`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-Internal-Service': 'nest-backend',
          'X-Internal-Token': sharedToken,
          'X-Request-Id': input.jobId,
        },
        body: JSON.stringify(input),
        signal: controller.signal,
      });

      const payload = (await response.json().catch(() => null)) as PivotNativeExportResponse | null;

      if (!response.ok || !payload?.success || !payload.data?.exportFileName || !payload.data.exportFilePath) {
        const message =
          payload?.error?.message ||
          `Pivot native export failed with status ${response.status}`;
        this.logger.error(message);
        throw new InternalServerErrorException(message);
      }

      return {
        exportFileName: payload.data.exportFileName,
        exportFilePath: payload.data.exportFilePath,
        sheetName: payload.data.sheetName ?? 'Pivot',
        fileSizeBytes: Number(payload.data.fileSizeBytes ?? 0),
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new ServiceUnavailableException(
          `Pivot native export timed out after ${timeoutMs}ms`,
        );
      }
      throw error;
    } finally {
      clearTimeout(timeoutHandle);
    }
  }

  private readTimeoutMs() {
    const raw = this.configService.get<string>('PIVOT_EXPORT_TIMEOUT_MS') ?? '30000';
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 30000;
  }
}

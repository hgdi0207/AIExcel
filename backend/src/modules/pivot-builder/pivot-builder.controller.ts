import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { AiService } from '../ai/ai.service';
import { FilesService } from '../files/files.service';
import { JobsService } from '../jobs/jobs.service';
import { UsageService } from '../usage/usage.service';
import { PivotExportService } from './pivot-export.service';
import type { AuthUser } from '../../shared/auth.types';
import type { Response } from 'express';

@Controller('pivot-builder')
export class PivotBuilderController {
  constructor(
    private readonly aiService: AiService,
    private readonly filesService: FilesService,
    private readonly jobsService: JobsService,
    private readonly usageService: UsageService,
    private readonly pivotExportService: PivotExportService,
  ) {}

  @Post()
  async create(
    @Req() request: Request & { user?: AuthUser },
    @Body()
    body: {
      workbookId: string;
      sheetName?: string;
      prompt: string;
    },
  ) {
    const user = request.user;
    if (!user) {
      throw new UnauthorizedException('Missing user session');
    }

    const preview = await this.filesService.getWorkbookPreview(body.workbookId, user.id);
    const sheetName = body.sheetName ?? preview.sheets[0]?.sheetName ?? 'Sheet1';
    const sheet =
      preview.sheets.find((item: (typeof preview.sheets)[number]) => item.sheetName === sheetName) ??
      preview.sheets[0];
    const job = await this.jobsService.createJob(
      user.id,
      'pivot',
      body.prompt || 'Build pivot table',
      {
        workbookId: body.workbookId,
        sheetName,
      },
      async ({ job: currentJob }) => {
        const execution = await this.aiService.generatePivotConfig({
          userId: user.id,
          prompt: body.prompt || 'Build pivot table',
          workbook: {
            workbookId: preview.workbook.id,
            fileName: preview.workbook.fileName,
            mimeType: preview.workbook.mimeType,
            summaryMd: preview.workbook.summaryMd,
            rowCount: preview.workbook.rowCount,
            sheetCount: preview.workbook.sheetCount,
            localFilePath: preview.workbook.localFilePath,
          },
          sheet: {
            sheetName: sheet?.sheetName ?? 'Sheet1',
            headers: sheet?.headers ?? [],
            sampleRows: sheet?.sampleRows ?? [],
            rowCount: sheet?.rowCount ?? 0,
            columnCount: sheet?.columnCount ?? 0,
          },
        });
        await this.jobsService.markPivotExportStarted(currentJob.id);

        let exportInfo;
        try {
          exportInfo = await this.pivotExportService.createPivotExport({
            jobId: currentJob.id,
            userId: user.id,
            workbook: {
              fileName: preview.workbook.fileName,
              mimeType: preview.workbook.mimeType,
              localFilePath: preview.workbook.localFilePath,
            },
            sheetName: sheet?.sheetName ?? 'Sheet1',
            config: execution.output,
          });
          await this.jobsService.markPivotExportCompleted(currentJob.id, exportInfo);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Pivot export failed';
          await this.jobsService.markPivotExportFailed(currentJob.id, message);
          throw error;
        }

        return {
          result: {
            ...execution.output,
            exportFileUrl: exportInfo.exportFileUrl,
            exportFileName: exportInfo.exportFileName,
            exportFileSizeBytes: exportInfo.exportFileSizeBytes,
            exportSheetName: exportInfo.sheetName,
            exportStatus: 'completed',
            exportMode: this.pivotExportService.getExportMode(),
          },
          aiRequestId: execution.aiRequestId,
        };
      },
    );
    await this.usageService.recordUsage(user.id, 'pivot_builder', 4, {
      jobId: job.id,
      jobType: 'pivot',
      workbookId: body.workbookId,
    });

    return {
      success: true,
      data: {
        job: {
          id: job.id,
          status: job.status,
          creditsConsumed: 0,
        },
        polling: true,
      },
    };
  }

  @Get(':id')
  async detail(@Req() request: Request & { user?: AuthUser }, @Param('id') id: string) {
    const user = request.user;
    if (!user) {
      throw new UnauthorizedException('Missing user session');
    }

    const job = await this.jobsService.getJobForUser(id, user.id);
    return {
      success: true,
      data: {
        job: {
          id: job.id,
          status: job.status,
          progress: job.progress,
          errorMessage: job.errorMessage,
        },
        result: job.result,
      },
    };
  }

  @Get(':id/download')
  async download(
    @Req() request: Request & { user?: AuthUser },
    @Param('id') id: string,
    @Res() response: Response,
  ) {
    const user = request.user;
    if (!user) {
      throw new UnauthorizedException('Missing user session');
    }

    const job = await this.jobsService.getJobForUser(id, user.id);
    const result = job.result as
      | {
          exportFileUrl?: string;
          exportFileName?: string;
        }
      | null;
    if (!result?.exportFileUrl || !result.exportFileName) {
      throw new NotFoundException('Export file not found');
    }

    const exportFilePath = await this.pivotExportService.ensureExportExists(id, result.exportFileName);
    const exportFileName = result.exportFileName;

    return response.download(exportFilePath, exportFileName);
  }
}

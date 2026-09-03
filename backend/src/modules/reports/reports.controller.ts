import { Body, Controller, Get, Param, Post, Req, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { AiService } from '../ai/ai.service';
import { FilesService } from '../files/files.service';
import { JobsService } from '../jobs/jobs.service';
import { UsageService } from '../usage/usage.service';
import type { AuthUser } from '../../shared/auth.types';

@Controller('reports')
export class ReportsController {
  constructor(
    private readonly aiService: AiService,
    private readonly filesService: FilesService,
    private readonly jobsService: JobsService,
    private readonly usageService: UsageService,
  ) {}

  @Post()
  async create(
    @Req() request: Request & { user?: AuthUser },
    @Body()
    body: {
      workbookId: string;
      prompt: string;
      format?: 'md' | 'docx' | 'pdf';
      complexity?: 'normal' | 'complex';
    },
  ) {
    const user = request.user;
    if (!user) {
      throw new UnauthorizedException('Missing user session');
    }

    const preview = await this.filesService.getWorkbookPreview(body.workbookId, user.id);
    const job = await this.jobsService.createJob(
      user.id,
      'report',
      body.prompt || 'Generate report',
      {
        workbookId: body.workbookId,
        format: body.format ?? 'md',
        complexity: body.complexity ?? 'normal',
      },
      async () => {
        const execution = await this.aiService.generateReport({
          userId: user.id,
          prompt: body.prompt || 'Generate report',
          format: body.format ?? 'md',
          complexity: body.complexity ?? 'normal',
          workbook: {
            workbookId: preview.workbook.id,
            fileName: preview.workbook.fileName,
            mimeType: preview.workbook.mimeType,
            summaryMd: preview.workbook.summaryMd,
            rowCount: preview.workbook.rowCount,
            sheetCount: preview.workbook.sheetCount,
            localFilePath: preview.workbook.localFilePath,
          },
          sheets: preview.sheets.map((sheet: (typeof preview.sheets)[number]) => ({
            sheetName: sheet.sheetName,
            headers: sheet.headers,
            sampleRows: sheet.sampleRows,
            rowCount: sheet.rowCount,
            columnCount: sheet.columnCount,
          })),
        });
        return {
          result: execution.output,
          aiRequestId: execution.aiRequestId,
        };
      },
    );
    await this.usageService.recordUsage(user.id, 'reports', 8, {
      jobId: job.id,
      jobType: 'report',
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
        },
        result: job.result,
      },
    };
  }
}

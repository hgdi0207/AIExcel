import { Body, Controller, Get, Param, Post, Req, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { AiService } from '../ai/ai.service';
import { FilesService } from '../files/files.service';
import { JobsService } from '../jobs/jobs.service';
import { UsageService } from '../usage/usage.service';
import type { AuthUser } from '../../shared/auth.types';
import { WorkbookAnalysisService } from '../workbook-analysis/workbook-analysis.service';

@Controller('charts')
export class ChartsController {
  constructor(
    private readonly aiService: AiService,
    private readonly filesService: FilesService,
    private readonly jobsService: JobsService,
    private readonly usageService: UsageService,
    private readonly workbookAnalysisService: WorkbookAnalysisService,
  ) {}

  @Post()
  async create(
    @Req() request: Request & { user?: AuthUser },
    @Body()
    body: {
      workbookId: string;
      prompt: string;
      preferredChartType?: 'bar' | 'line' | 'pie' | 'scatter';
    },
  ) {
    const user = request.user;
    if (!user) {
      throw new UnauthorizedException('Missing user session');
    }

    const preview = await this.filesService.getWorkbookPreview(body.workbookId, user.id);
    const sheet = preview.sheets[0];
    if (!preview.workbook.localFilePath) {
      throw new UnauthorizedException('Workbook source file is unavailable');
    }
    const workbookAnalysis = this.workbookAnalysisService.analyzeWorkbookFromFile(
      preview.workbook.localFilePath,
      preview.workbook.fileName,
    );
    const chartContext = this.workbookAnalysisService.buildChartContext(workbookAnalysis, {
      prompt: body.prompt || 'Create chart',
      preferredChartType: body.preferredChartType ?? 'line',
      requestedSheetName: sheet?.sheetName,
    });
    const job = await this.jobsService.createJob(
      user.id,
      'chart',
      body.prompt || 'Create chart',
      {
        workbookId: body.workbookId,
        preferredChartType: body.preferredChartType ?? 'line',
      },
      async () => {
        const execution = await this.aiService.generateChart({
          userId: user.id,
          prompt: body.prompt || 'Create chart',
          preferredChartType: body.preferredChartType ?? 'line',
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
          chartContext,
        });
        const aiTitle =
          typeof execution.output.title === 'string' && execution.output.title.trim().length > 0
            ? execution.output.title.trim()
            : chartContext.title;
        return {
          result: {
            ...chartContext,
            title: aiTitle,
          },
          aiRequestId: execution.aiRequestId,
        };
      },
    );
    await this.usageService.recordUsage(user.id, 'charts', 5, {
      jobId: job.id,
      jobType: 'chart',
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

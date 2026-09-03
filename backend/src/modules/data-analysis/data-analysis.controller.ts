import { Body, Controller, Get, Param, Post, Req, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { AiService } from '../ai/ai.service';
import { FilesService } from '../files/files.service';
import { JobsService } from '../jobs/jobs.service';
import { UsageService } from '../usage/usage.service';
import type { AuthUser } from '../../shared/auth.types';
import { WorkbookAnalysisService } from '../workbook-analysis/workbook-analysis.service';

@Controller('data-analysis')
export class DataAnalysisController {
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
      sheetNames?: string[];
      regionId?: string;
      mode?: 'auto' | 'guided';
      complexity?: 'normal' | 'complex';
    },
  ) {
    const user = request.user;
    if (!user) {
      throw new UnauthorizedException('Missing user session');
    }

    const preview = await this.filesService.getWorkbookPreview(body.workbookId, user.id);
    if (!preview.workbook.localFilePath) {
      throw new UnauthorizedException('Workbook source file is unavailable');
    }
    const workbookAnalysis = this.workbookAnalysisService.analyzeWorkbookFromFile(
      preview.workbook.localFilePath,
      preview.workbook.fileName,
    );
    const analysisContext = this.workbookAnalysisService.buildAnalysisContext(workbookAnalysis, {
      requestedSheetNames:
        body.sheetNames ?? preview.sheets.map((sheet: (typeof preview.sheets)[number]) => sheet.sheetName),
      prompt: body.prompt || 'Analyze workbook',
      complexity: body.complexity ?? 'normal',
    });
    const job = await this.jobsService.createJob(
      user.id,
      'analysis',
      body.prompt || 'Analyze workbook',
      {
        workbookId: body.workbookId,
        sheetNames:
          body.sheetNames ?? preview.sheets.map((sheet: (typeof preview.sheets)[number]) => sheet.sheetName),
        regionId: body.regionId ?? analysisContext.dataset.regionId,
        mode: body.mode ?? 'auto',
        complexity: body.complexity ?? 'normal',
      },
      async () => {
        const execution = await this.aiService.generateAnalysis({
          userId: user.id,
          prompt: body.prompt || 'Analyze workbook',
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
          analysisContext,
        });
        return {
          result: execution.output,
          aiRequestId: execution.aiRequestId,
        };
      },
    );
    await this.usageService.recordUsage(user.id, 'data_analysis', 7, {
      jobId: job.id,
      jobType: 'analysis',
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
}

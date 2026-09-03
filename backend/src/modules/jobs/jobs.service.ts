import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { JobKind, JobRecord, JobRunInput, JobStatus } from './jobs.types';

type JobLookupResult = {
  kind: JobKind;
  record: JobRecord;
};

@Injectable()
export class JobsService {
  constructor(private readonly prismaService: PrismaService) {}

  async createJob<TPayload extends Record<string, unknown>, TResult>(
    userId: string,
    kind: JobKind,
    title: string,
    payload: TPayload,
    runner: (input: JobRunInput<TPayload, TResult>) => Promise<{
      result: TResult;
      aiRequestId?: string;
    }>,
  ) {
    const job = await this.createJobRecord(userId, kind, title, payload);
    void this.runAsync(job.id, kind, runner);
    return job;
  }

  async getJob<
    TPayload extends Record<string, unknown> = Record<string, unknown>,
    TResult = unknown,
  >(id: string) {
    const job = await this.findJobById(id);
    return job.record as JobRecord<TPayload, TResult>;
  }

  async getJobForUser<
    TPayload extends Record<string, unknown> = Record<string, unknown>,
    TResult = unknown,
  >(id: string, userId: string) {
    const job = await this.getJob<TPayload, TResult>(id);
    if (job.userId !== userId) {
      throw new NotFoundException('Job not found');
    }
    return job;
  }

  async getResult(id: string) {
    const job = await this.getJob(id);
    if (job.status !== 'completed') {
      return null;
    }
    return job.result;
  }

  async completeJob<TResult>(id: string, result: TResult) {
    const lookup = await this.findJobById(id);
    await this.updateJobRecord(lookup.kind, id, {
      status: 'completed',
      result,
    });
    return this.getJob(id);
  }

  async attachAiRequestId(id: string, aiRequestId: string) {
    const lookup = await this.findJobById(id);

    if (lookup.kind === 'analysis') {
      await this.prismaService.analysisJob.update({
        where: { id },
        data: { aiRequestId },
      });
      return;
    }

    if (lookup.kind === 'pivot') {
      await this.prismaService.pivotJob.update({
        where: { id },
        data: { aiRequestId },
      });
      return;
    }

    if (lookup.kind === 'chart') {
      await this.prismaService.chartJob.update({
        where: { id },
        data: { aiRequestId },
      });
      return;
    }

    await this.prismaService.reportJob.update({
      where: { id },
      data: { aiRequestId },
    });
  }

  async failJob(id: string, errorMessage: string) {
    const lookup = await this.findJobById(id);
    await this.updateJobRecord(lookup.kind, id, {
      status: 'failed',
      errorMessage,
    });
    return this.getJob(id);
  }

  async markPivotExportStarted(id: string) {
    await this.prismaService.pivotJob.update({
      where: { id },
      data: {
        exportStatus: 'pending',
        exportErrorMessage: null,
        exportStartedAt: new Date(),
      } as never,
    });
  }

  async markPivotExportCompleted(
    id: string,
    input: {
      exportFileName: string;
      exportFileUrl: string;
      exportFileSizeBytes: number;
      sheetName: string;
    },
  ) {
    await this.prismaService.pivotJob.update({
      where: { id },
      data: {
        exportFileName: input.exportFileName,
        exportFileUrl: input.exportFileUrl,
        exportFileSizeBytes: BigInt(input.exportFileSizeBytes),
        exportSheetName: input.sheetName,
        exportStatus: 'completed',
        exportErrorMessage: null,
        exportCompletedAt: new Date(),
      } as never,
    });
  }

  async markPivotExportFailed(id: string, errorMessage: string) {
    await this.prismaService.pivotJob.update({
      where: { id },
      data: {
        exportStatus: 'failed',
        exportErrorMessage: errorMessage.slice(0, 1000),
        exportCompletedAt: new Date(),
      } as never,
    });
  }

  private async createJobRecord(
    userId: string,
    kind: JobKind,
    title: string,
    payload: Record<string, unknown>,
  ) {
    if (kind === 'analysis') {
      const job = await this.prismaService.analysisJob.create({
        data: {
          userId,
          workbookId: this.requireString(payload, 'workbookId'),
          prompt: title,
          scopeJson: {
            sheetNames: this.readStringArray(payload, 'sheetNames'),
            regionId: this.readString(payload, 'regionId') ?? null,
            mode: this.readString(payload, 'mode') ?? 'auto',
          },
          complexity: this.readString(payload, 'complexity') ?? 'normal',
          status: 'queued',
        },
      });
      return this.toAnalysisJobRecord(job);
    }

    if (kind === 'pivot') {
      const job = await this.prismaService.pivotJob.create({
        data: {
          userId,
          workbookId: this.requireString(payload, 'workbookId'),
          sheetName: this.readString(payload, 'sheetName') ?? 'Sheet1',
          prompt: title,
          configJson: payload,
          exportStatus: 'pending',
          status: 'queued',
        } as never,
      });
      return this.toPivotJobRecord(job);
    }

    if (kind === 'chart') {
      const job = await this.prismaService.chartJob.create({
        data: {
          userId,
          workbookId: this.requireString(payload, 'workbookId'),
          prompt: title,
          chartType: this.readString(payload, 'preferredChartType') ?? 'line',
          configJson: payload,
          status: 'queued',
        },
      });
      return this.toChartJobRecord(job);
    }

    const job = await this.prismaService.reportJob.create({
      data: {
        userId,
        workbookId: this.requireString(payload, 'workbookId'),
        prompt: title,
        format: (this.readString(payload, 'format') ?? 'md') as 'md' | 'docx' | 'pdf',
        complexity: this.readString(payload, 'complexity') ?? 'normal',
        status: 'queued',
      },
    });
    return this.toReportJobRecord(job);
  }

  private async findJobById(id: string): Promise<JobLookupResult> {
    const pivot = await this.prismaService.pivotJob.findUnique({ where: { id } });
    if (pivot) {
      return { kind: 'pivot', record: this.toPivotJobRecord(pivot) };
    }

    const analysis = await this.prismaService.analysisJob.findUnique({ where: { id } });
    if (analysis) {
      return { kind: 'analysis', record: this.toAnalysisJobRecord(analysis) };
    }

    const chart = await this.prismaService.chartJob.findUnique({ where: { id } });
    if (chart) {
      return { kind: 'chart', record: this.toChartJobRecord(chart) };
    }

    const report = await this.prismaService.reportJob.findUnique({ where: { id } });
    if (report) {
      return { kind: 'report', record: this.toReportJobRecord(report) };
    }

    throw new NotFoundException('Job not found');
  }

  private async updateJobRecord(
    kind: JobKind,
    id: string,
    input: {
      status: JobStatus;
      result?: unknown;
      errorMessage?: string;
    },
  ) {
    const completedAt = input.status === 'completed' ? new Date() : null;

    if (kind === 'analysis') {
      await this.prismaService.analysisJob.update({
        where: { id },
        data: {
          status: input.status,
          summaryMd: this.readString(input.result as Record<string, unknown> | undefined, 'summaryMd'),
          insightsJson: this.readObject(input.result as Record<string, unknown> | undefined, 'insights'),
          factsJson: this.readObject(input.result as Record<string, unknown> | undefined, 'facts'),
          datasetRefJson: this.readObject(input.result as Record<string, unknown> | undefined, 'dataset'),
          qualityWarningsJson: this.readObject(
            input.result as Record<string, unknown> | undefined,
            'qualityWarnings',
          ),
          followupSuggestionsJson: this.readObject(
            input.result as Record<string, unknown> | undefined,
            'followupSuggestions',
          ),
          confidenceScore:
            this.readNumber(input.result as Record<string, unknown> | undefined, 'confidenceScore') ??
            undefined,
          errorMessage: input.errorMessage,
          completedAt,
        },
      });
      return;
    }

    if (kind === 'pivot') {
      await this.prismaService.pivotJob.update({
        where: { id },
        data: {
          status: input.status,
          resultJson: input.result ?? undefined,
          exportStatus: input.status === 'failed' ? 'failed' : undefined,
          exportErrorMessage:
            input.status === 'failed' ? input.errorMessage?.slice(0, 1000) : undefined,
          exportCompletedAt: input.status === 'failed' ? new Date() : undefined,
          errorMessage: input.errorMessage,
          completedAt,
        } as never,
      });
      return;
    }

    if (kind === 'chart') {
      const result = input.result as Record<string, unknown> | undefined;
      await this.prismaService.chartJob.update({
        where: { id },
        data: {
          status: input.status,
          chartType: this.readString(result, 'chartType') ?? undefined,
          previewJson: result ?? undefined,
          errorMessage: input.errorMessage,
          completedAt,
        },
      });
      return;
    }

    const result = input.result as Record<string, unknown> | undefined;
    await this.prismaService.reportJob.update({
      where: { id },
      data: {
        status: input.status,
        contentMd: this.readString(result, 'contentMd') ?? undefined,
        exportFileUrl: this.readString(result, 'exportFileUrl') ?? undefined,
        errorMessage: input.errorMessage,
        completedAt,
      },
    });
  }

  private async runAsync<TPayload extends Record<string, unknown>, TResult>(
    jobId: string,
    kind: JobKind,
    runner: (input: JobRunInput<TPayload, TResult>) => Promise<{
      result: TResult;
      aiRequestId?: string;
    }>,
  ) {
    setTimeout(() => {
      void (async () => {
        try {
          await this.updateJobRecord(kind, jobId, { status: 'running' });
          const latest = await this.getJob<TPayload, TResult>(jobId);
          if (latest.status !== 'queued' && latest.status !== 'running') {
            return;
          }
          const execution = await runner({ job: latest });
          if (execution.aiRequestId) {
            await this.attachAiRequestId(jobId, execution.aiRequestId);
          }
          await this.completeJob(jobId, execution.result);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Job failed';
          await this.failJob(jobId, message);
        }
      })();
    }, 80);
  }

  private requireString(payload: Record<string, unknown>, key: string) {
    const value = payload[key];
    if (typeof value !== 'string' || value.length === 0) {
      throw new NotFoundException(`${key} is required`);
    }
    return value;
  }

  private readString(payload: Record<string, unknown> | undefined, key: string) {
    const value = payload?.[key];
    return typeof value === 'string' ? value : undefined;
  }

  private readStringArray(payload: Record<string, unknown>, key: string) {
    const value = payload[key];
    if (!Array.isArray(value)) {
      return [];
    }
    return value.map((item) => String(item));
  }

  private readObject(payload: Record<string, unknown> | undefined, key: string) {
    const value = payload?.[key];
    return value ?? undefined;
  }

  private readNumber(payload: Record<string, unknown> | undefined, key: string) {
    const value = payload?.[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string') {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  }

  private toProgress(status: JobStatus) {
    if (status === 'queued') {
      return 0;
    }
    if (status === 'running') {
      return 45;
    }
    return 100;
  }

  private toPivotJobRecord(job: {
    id: string;
    userId: string;
    workbookId: string;
    sheetName: string;
    prompt: string;
    configJson: unknown;
    resultJson: unknown;
    exportFileName?: string | null;
    exportFileUrl?: string | null;
    exportFileSizeBytes?: bigint | null;
    exportSheetName?: string | null;
    exportStatus?: string | null;
    exportErrorMessage?: string | null;
    exportStartedAt?: Date | null;
    exportCompletedAt?: Date | null;
    status: JobStatus;
    errorMessage: string | null;
    createdAt: Date;
    completedAt: Date | null;
  }): JobRecord {
    return {
      id: job.id,
      userId: job.userId,
      kind: 'pivot',
      status: job.status,
      progress: this.toProgress(job.status),
      title: job.prompt,
      payload: this.toObject(job.configJson, {
        workbookId: job.workbookId,
        sheetName: job.sheetName,
      }),
      result: this.toPivotResult(job),
      errorMessage: job.errorMessage,
      createdAt: job.createdAt.toISOString(),
      updatedAt: (job.completedAt ?? job.createdAt).toISOString(),
      completedAt: job.completedAt?.toISOString() ?? null,
    };
  }

  private toAnalysisJobRecord(job: {
    id: string;
    userId: string;
    workbookId: string;
    prompt: string;
    scopeJson: unknown;
    summaryMd: string | null;
    insightsJson: unknown;
    factsJson: unknown;
    datasetRefJson: unknown;
    qualityWarningsJson: unknown;
    followupSuggestionsJson: unknown;
    confidenceScore: { toString(): string } | null;
    complexity: string | null;
    status: JobStatus;
    errorMessage: string | null;
    createdAt: Date;
    completedAt: Date | null;
  }): JobRecord {
    return {
      id: job.id,
      userId: job.userId,
      kind: 'analysis',
      status: job.status,
      progress: this.toProgress(job.status),
      title: job.prompt,
      payload: this.toObject(job.scopeJson, {
        workbookId: job.workbookId,
        complexity: job.complexity ?? 'normal',
      }),
      result:
        job.summaryMd || job.insightsJson
          ? {
              summaryMd: job.summaryMd,
              insights: this.toUnknownResult(job.insightsJson),
              facts: this.toUnknownResult(job.factsJson),
              dataset: this.toUnknownResult(job.datasetRefJson),
              qualityWarnings: this.toUnknownResult(job.qualityWarningsJson),
              followupSuggestions: this.toUnknownResult(job.followupSuggestionsJson),
              confidenceScore: this.toNumberOrNull(job.confidenceScore),
            }
          : null,
      errorMessage: job.errorMessage,
      createdAt: job.createdAt.toISOString(),
      updatedAt: (job.completedAt ?? job.createdAt).toISOString(),
      completedAt: job.completedAt?.toISOString() ?? null,
    };
  }

  private toChartJobRecord(job: {
    id: string;
    userId: string;
    workbookId: string;
    prompt: string;
    chartType: string | null;
    configJson: unknown;
    previewJson: unknown;
    status: JobStatus;
    errorMessage: string | null;
    createdAt: Date;
    completedAt: Date | null;
  }): JobRecord {
    return {
      id: job.id,
      userId: job.userId,
      kind: 'chart',
      status: job.status,
      progress: this.toProgress(job.status),
      title: job.prompt,
      payload: this.toObject(job.configJson, {
        workbookId: job.workbookId,
        preferredChartType: job.chartType ?? 'line',
      }),
      result: this.toUnknownResult(job.previewJson),
      errorMessage: job.errorMessage,
      createdAt: job.createdAt.toISOString(),
      updatedAt: (job.completedAt ?? job.createdAt).toISOString(),
      completedAt: job.completedAt?.toISOString() ?? null,
    };
  }

  private toReportJobRecord(job: {
    id: string;
    userId: string;
    workbookId: string;
    prompt: string;
    format: 'md' | 'docx' | 'pdf';
    contentMd: string | null;
    exportFileUrl: string | null;
    complexity: string | null;
    status: JobStatus;
    errorMessage: string | null;
    createdAt: Date;
    completedAt: Date | null;
  }): JobRecord {
    return {
      id: job.id,
      userId: job.userId,
      kind: 'report',
      status: job.status,
      progress: this.toProgress(job.status),
      title: job.prompt,
      payload: {
        workbookId: job.workbookId,
        format: job.format,
        complexity: job.complexity ?? 'normal',
      },
      result:
        job.contentMd || job.exportFileUrl
          ? {
              format: job.format,
              contentMd: job.contentMd,
              exportFileUrl: job.exportFileUrl,
            }
          : null,
      errorMessage: job.errorMessage,
      createdAt: job.createdAt.toISOString(),
      updatedAt: (job.completedAt ?? job.createdAt).toISOString(),
      completedAt: job.completedAt?.toISOString() ?? null,
    };
  }

  private toObject(value: unknown, fallback: Record<string, unknown>) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return fallback;
    }
    return value as Record<string, unknown>;
  }

  private toUnknownResult(value: unknown) {
    return value ?? null;
  }

  private toNumberOrNull(value: { toString(): string } | null) {
    if (!value) {
      return null;
    }
    const parsed = Number(value.toString());
    return Number.isFinite(parsed) ? parsed : null;
  }

  private toPivotResult(job: {
    resultJson: unknown;
    exportFileName?: string | null;
    exportFileUrl?: string | null;
    exportFileSizeBytes?: bigint | null;
    exportSheetName?: string | null;
    exportStatus?: string | null;
    exportErrorMessage?: string | null;
    exportStartedAt?: Date | null;
    exportCompletedAt?: Date | null;
  }) {
    const baseResult = this.toObject(job.resultJson, {});
    const result: Record<string, unknown> = { ...baseResult };

    if (job.exportFileName) {
      result.exportFileName = job.exportFileName;
    }
    if (job.exportFileUrl) {
      result.exportFileUrl = job.exportFileUrl;
    }
    if (job.exportFileSizeBytes !== null && job.exportFileSizeBytes !== undefined) {
      result.exportFileSizeBytes = Number(job.exportFileSizeBytes);
    }
    if (job.exportSheetName) {
      result.exportSheetName = job.exportSheetName;
    }
    if (job.exportStatus) {
      result.exportStatus = job.exportStatus;
    }
    if (job.exportErrorMessage) {
      result.exportErrorMessage = job.exportErrorMessage;
    }
    if (job.exportStartedAt) {
      result.exportStartedAt = job.exportStartedAt.toISOString();
    }
    if (job.exportCompletedAt) {
      result.exportCompletedAt = job.exportCompletedAt.toISOString();
    }

    return Object.keys(result).length > 0 ? result : null;
  }
}

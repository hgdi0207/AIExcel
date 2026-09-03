import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import type { ToolType } from '@prisma/client';
import {
  AiExecutionError,
  type AiRequestPayload,
  type AiTaskModelTier,
  type AiTaskSuccess,
  type AnalysisGenerationInput,
  type AssistantGenerationInput,
  type ChartGenerationInput,
  type PivotGenerationInput,
  type ReportGenerationInput,
} from './ai.types';

type OpenAIResponseUsage = {
  input_tokens?: number;
  output_tokens?: number;
  prompt_tokens?: number;
  completion_tokens?: number;
};

type OpenAIResponseOutputItem = {
  type?: string;
  text?: string;
  content?: Array<{
    type?: string;
    text?: string;
  }>;
};

type OpenAIResponsePayload = {
  id?: string;
  output_text?: string;
  usage?: OpenAIResponseUsage;
  output?: OpenAIResponseOutputItem[];
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>;
    };
  }>;
};

type OpenAICompatibleEnvelope = OpenAIResponsePayload & {
  data?: OpenAIResponsePayload;
};

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly apiBaseUrl: string;
  private readonly apiKey: string;
  private readonly enableInputFile: boolean;

  constructor(
    private readonly configService: ConfigService,
    private readonly prismaService: PrismaService,
  ) {
    this.apiBaseUrl = (
      this.configService.get<string>('AI_PROVIDER_BASE_URL') ?? 'https://api.apimart.ai/v1'
    ).replace(/\/+$/, '');
    this.apiKey = this.configService.get<string>('AI_PROVIDER_API_KEY') ?? '';
    this.enableInputFile =
      (this.configService.get<string>('AI_PROVIDER_ENABLE_INPUT_FILE') ?? 'false')
        .toLowerCase()
        .trim() === 'true';
  }

  async generateAssistantReply(input: AssistantGenerationInput) {
    const workbookBlock = input.workbook
      ? [
          `Workbook: ${input.workbook.fileName}`,
          `Sheets: ${input.workbook.sheetCount}`,
          `Rows: ${input.workbook.rowCount}`,
          '',
          input.workbook.summaryMd,
        ].join('\n')
      : 'No workbook context attached.';

    return this.executeTextTask<string>({
      userId: input.userId,
      toolType: 'assistant',
      tier: 'default',
      promptVersion: 'assistant-v1',
      developerPrompt:
        'You are an AI spreadsheet assistant. Answer clearly and concretely. If workbook context exists, ground your answer in that workbook.',
      prompt: [
        workbookBlock,
        '',
        'Recent conversation:',
        ...input.recentMessages.map((message) => `[${message.role}] ${message.content}`),
        '',
        `User question: ${input.question}`,
        '',
        'Return a concise helpful answer in plain text.',
      ].join('\n'),
      workbook: input.workbook,
      metadata: {
        threadTitle: input.threadTitle ?? null,
      },
    });
  }

  async generatePivotConfig(input: PivotGenerationInput) {
    const fallback = {
      rows: input.sheet.headers.slice(0, 1),
      columns: input.sheet.headers.slice(1, 2),
      values: [
        {
          field: input.sheet.headers[2] ?? input.sheet.headers[0] ?? 'Value',
          aggregation: 'sum',
        },
      ],
      filters: [],
    };

    return this.executeJsonTask<typeof fallback>({
      userId: input.userId,
      toolType: 'pivot_builder',
      tier: 'default',
      promptVersion: 'pivot-v1',
      developerPrompt:
        'You design spreadsheet pivot table configs. Return only valid JSON with keys rows, columns, values, filters.',
      prompt: [
        `Workbook: ${input.workbook.fileName}`,
        input.workbook.summaryMd,
        '',
        `Target sheet: ${input.sheet.sheetName}`,
        `Headers: ${input.sheet.headers.join(', ')}`,
        `Sample rows: ${JSON.stringify(input.sheet.sampleRows)}`,
        '',
        `User request: ${input.prompt}`,
        '',
        'Output JSON schema:',
        '{"rows":["string"],"columns":["string"],"values":[{"field":"string","aggregation":"sum|avg|count|min|max"}],"filters":[{"field":"string","operator":"string","value":"string"}]}',
      ].join('\n'),
      workbook: input.workbook,
      metadata: {
        sheetName: input.sheet.sheetName,
      },
      fallback,
    });
  }

  async generateAnalysis(input: AnalysisGenerationInput) {
    const analysisContext = input.analysisContext;
    const fallback = {
      summaryMd: analysisContext.summaryMd,
      insights: [
        {
          type: 'trend',
          title: 'Workbook analyzed successfully',
          description: `Parsed ${input.workbook.sheetCount} sheet(s) from ${input.workbook.fileName}.`,
        },
      ],
      facts: analysisContext.factPack,
      dataset: analysisContext.dataset,
      qualityWarnings: analysisContext.qualityWarnings,
      confidenceScore: analysisContext.confidenceScore,
      followupSuggestions: analysisContext.followupSuggestions,
    };

    return this.executeJsonTask<typeof fallback>({
      userId: input.userId,
      toolType: 'data_analysis',
      tier: input.complexity === 'complex' ? 'complex' : 'default',
      promptVersion: 'analysis-v1',
      developerPrompt:
        'You are a data analyst for spreadsheet users. Return valid JSON with summaryMd, insights, facts, dataset, qualityWarnings, confidenceScore, and followupSuggestions. Use the supplied facts as the source of truth.',
      prompt: [
        `Workbook: ${input.workbook.fileName}`,
        input.workbook.summaryMd,
        '',
        'Analysis summary:',
        analysisContext.summaryMd,
        '',
        'Structured facts:',
        JSON.stringify(analysisContext.factPack),
        '',
        'Quality warnings:',
        JSON.stringify(analysisContext.qualityWarnings),
        '',
        `Selected dataset: ${JSON.stringify(analysisContext.dataset)}`,
        '',
        'Sheets:',
        ...input.sheets.map(
          (sheet) =>
            `- ${sheet.sheetName}: headers=${sheet.headers.join(', ')} sampleRows=${JSON.stringify(sheet.sampleRows)}`,
        ),
        '',
        `User request: ${input.prompt}`,
        '',
        'Output JSON schema:',
        '{"summaryMd":"markdown","insights":[{"type":"trend|anomaly|quality|recommendation","title":"string","description":"string"}],"facts":{},"dataset":{"sheetName":"string","regionId":"string","range":"string","headers":["string"],"rowCount":0,"columnCount":0,"timeField":null,"metricField":null,"dimensionField":null},"qualityWarnings":[{"type":"quality","level":"info|warning|critical","message":"string"}],"confidenceScore":0.91,"followupSuggestions":["string"]}',
      ].join('\n'),
      workbook: input.workbook,
      metadata: {
        sheetNames: input.sheets.map((sheet) => sheet.sheetName),
        complexity: input.complexity,
      },
      fallback,
    });
  }

  async generateChart(input: ChartGenerationInput) {
    const headers = input.sheet.headers;
    const fallback = {
      chartType: input.chartContext.chartType,
      title: input.chartContext.title,
      xAxis: input.chartContext.xAxis,
      yAxis: input.chartContext.yAxis,
      config: input.chartContext.config,
      chartData: input.chartContext.chartData,
      sourceSummary: input.chartContext.sourceSummary,
    };

    return this.executeJsonTask<typeof fallback>({
      userId: input.userId,
      toolType: 'charts',
      tier: 'default',
      promptVersion: 'charts-v1',
      developerPrompt:
        'You design chart suggestions from spreadsheet data. Use the supplied chart context and real chart data as the source of truth. Return valid JSON only.',
      prompt: [
        `Workbook: ${input.workbook.fileName}`,
        input.workbook.summaryMd,
        '',
        `Sheet: ${input.sheet.sheetName}`,
        `Headers: ${headers.join(', ')}`,
        `Sample rows: ${JSON.stringify(input.sheet.sampleRows)}`,
        '',
        `Chart context: ${JSON.stringify(input.chartContext)}`,
        '',
        `Preferred chart type: ${input.preferredChartType}`,
        `User request: ${input.prompt}`,
        '',
        'Output JSON schema:',
        '{"chartType":"bar|line|pie|scatter","title":"string","xAxis":"string","yAxis":"string","config":{"xAxisField":"string","yAxisField":"string","sourceSheet":"string"},"chartData":{"sourceKind":"trend|ranking|scatter|raw","labels":["string"],"values":[1],"points":[{"label":"string","value":1,"x":1,"y":2}]},"sourceSummary":"string"}',
      ].join('\n'),
      workbook: input.workbook,
      metadata: {
        sheetName: input.sheet.sheetName,
        preferredChartType: input.preferredChartType,
      },
      fallback,
    });
  }

  async generateReport(input: ReportGenerationInput) {
    const fallback = {
      format: input.format,
      contentMd: [
        '# Executive Summary',
        '',
        `- File: ${input.workbook.fileName}`,
        `- Sheets: ${input.workbook.sheetCount}`,
        '',
        'This report is written in English for the target customer audience.',
      ].join('\n'),
      exportFileUrl: null,
    };

    return this.executeJsonTask<typeof fallback>({
      userId: input.userId,
      toolType: 'reports',
      tier: input.complexity === 'complex' ? 'complex' : 'default',
      promptVersion: 'reports-v1',
      developerPrompt:
        'You generate spreadsheet reports. Return valid JSON only with format, contentMd, exportFileUrl. Write all prose, headings, bullet points, and explanatory text in English only. Keep proper nouns and sheet names unchanged if needed, but do not use Chinese characters in the report text.',
      prompt: [
        `Workbook: ${input.workbook.fileName}`,
        input.workbook.summaryMd,
        '',
        'Sheets:',
        ...input.sheets.map(
          (sheet) => `- ${sheet.sheetName}: headers=${sheet.headers.join(', ')}`,
        ),
        '',
        `Requested output format: ${input.format}`,
        `User request: ${input.prompt}`,
        '',
        'Language requirement: write the entire report in English only.',
        '',
        'Output JSON schema:',
        '{"format":"md|docx|pdf","contentMd":"markdown","exportFileUrl":null}',
      ].join('\n'),
      workbook: input.workbook,
      metadata: {
        format: input.format,
        complexity: input.complexity,
      },
      fallback,
    });
  }

  private async executeTextTask<TResult extends string>(
    payload: AiRequestPayload,
  ): Promise<AiTaskSuccess<TResult>> {
    const record = await this.createAiRequestRecord(payload);
    const startedAt = Date.now();

    try {
      if (!this.isProviderConfigured()) {
        const fallback = (`[Mock AI] ${payload.prompt.split('\n').slice(-3).join(' ')}` ||
          '[Mock AI] Ready.') as TResult;
        await this.markAiRequestSuccess(record.id, payload, startedAt, {
          responseId: null,
          outputText: fallback,
          inputTokens: null,
          outputTokens: null,
          costUsd: 0,
        });
        return {
          aiRequestId: record.id,
          output: fallback,
        };
      }

      const response = await this.callResponsesApi(payload);
      const outputText = this.extractOutputText(response).trim();
      if (!outputText) {
        throw new Error('AI response is empty');
      }

      await this.markAiRequestSuccess(record.id, payload, startedAt, {
        responseId: response.id ?? null,
        outputText,
        inputTokens:
          response.usage?.input_tokens ?? response.usage?.prompt_tokens ?? null,
        outputTokens:
          response.usage?.output_tokens ?? response.usage?.completion_tokens ?? null,
        costUsd: 0,
      });

      return {
        aiRequestId: record.id,
        output: outputText as TResult,
      };
    } catch (error) {
      await this.markAiRequestFailure(record.id, error, startedAt);
      throw new AiExecutionError(
        error instanceof Error ? error.message : 'AI request failed',
        record.id,
      );
    }
  }

  private async executeJsonTask<TResult>(
    payload: AiRequestPayload & { fallback: TResult },
  ): Promise<AiTaskSuccess<TResult>> {
    const record = await this.createAiRequestRecord(payload);
    const startedAt = Date.now();

    try {
      if (!this.isProviderConfigured()) {
        await this.markAiRequestSuccess(record.id, payload, startedAt, {
          responseId: null,
          outputText: JSON.stringify(payload.fallback),
          inputTokens: null,
          outputTokens: null,
          costUsd: 0,
        });
        return {
          aiRequestId: record.id,
          output: payload.fallback,
        };
      }

      const response = await this.callResponsesApi(payload, {
        type: 'json_schema',
        name: `${payload.toolType}_result`,
        strict: true,
        schema: this.buildLooseSchema(payload.fallback),
      });
      const outputText = this.extractOutputText(response).trim();
      if (!outputText) {
        throw new Error('AI response is empty');
      }

      let parsed: TResult;
      try {
        parsed = JSON.parse(outputText) as TResult;
      } catch {
        throw new Error(`AI returned invalid JSON: ${outputText.slice(0, 400)}`);
      }

      await this.markAiRequestSuccess(record.id, payload, startedAt, {
        responseId: response.id ?? null,
        outputText,
        inputTokens:
          response.usage?.input_tokens ?? response.usage?.prompt_tokens ?? null,
        outputTokens:
          response.usage?.output_tokens ?? response.usage?.completion_tokens ?? null,
        costUsd: 0,
      });

      return {
        aiRequestId: record.id,
        output: parsed,
      };
    } catch (error) {
      await this.markAiRequestFailure(record.id, error, startedAt);
      if (!this.isProviderConfigured()) {
        return {
          aiRequestId: record.id,
          output: payload.fallback,
        };
      }
      throw new AiExecutionError(
        error instanceof Error ? error.message : 'AI request failed',
        record.id,
      );
    }
  }

  private async createAiRequestRecord(payload: AiRequestPayload) {
    return this.prismaService.aiRequest.create({
      data: {
        userId: payload.userId,
        toolType: payload.toolType,
        modelProvider: 'openai-compatible',
        modelName: this.getModelName(payload.tier),
        promptVersion: payload.promptVersion,
        inputRefJson: {
          hasWorkbook: Boolean(payload.workbook),
          workbookId: payload.workbook?.workbookId ?? null,
          metadata: payload.metadata ?? null,
        },
        status: 'queued',
      },
    });
  }

  private async markAiRequestSuccess(
    requestId: string,
    payload: AiRequestPayload,
    startedAt: number,
    result: {
      responseId: string | null;
      outputText: string;
      inputTokens: number | null;
      outputTokens: number | null;
      costUsd: number;
    },
  ) {
    await this.prismaService.aiRequest.update({
      where: { id: requestId },
      data: {
        status: 'completed',
        latencyMs: Date.now() - startedAt,
        inputTokens: result.inputTokens ?? undefined,
        outputTokens: result.outputTokens ?? undefined,
        costUsd: result.costUsd,
        outputRefJson: {
          responseId: result.responseId,
          preview: result.outputText.slice(0, 3000),
        },
      },
    });
  }

  private async markAiRequestFailure(
    requestId: string,
    error: unknown,
    startedAt: number,
  ) {
    const message = error instanceof Error ? error.message : 'AI request failed';
    await this.prismaService.aiRequest.update({
      where: { id: requestId },
      data: {
        status: 'failed',
        latencyMs: Date.now() - startedAt,
        errorCode: 'request_failed',
        errorMessage: message.slice(0, 1000),
      },
    });
  }

  private async callResponsesApi(
    payload: AiRequestPayload,
    textFormat?: Record<string, unknown>,
  ): Promise<OpenAIResponsePayload> {
    const systemPrompt = [
      'You are a spreadsheet-focused AI assistant. Follow the requested output format exactly.',
      payload.developerPrompt,
    ]
      .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
      .join('\n\n');

    const body: Record<string, unknown> = {
      model: this.getModelName(payload.tier),
      input: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: this.buildUserContent(payload),
        },
      ],
    };

    if (textFormat) {
      body.text = {
        format: textFormat,
      };
    }

    const response = await fetch(`${this.apiBaseUrl}/responses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(`AI provider request failed: ${response.status} ${errorText}`);
      throw new InternalServerErrorException(
        `AI provider request failed with status ${response.status}`,
      );
    }

    const responseJson = (await response.json()) as OpenAICompatibleEnvelope;
    return this.unwrapResponsePayload(responseJson);
  }

  private buildUserContent(payload: AiRequestPayload) {
    const content: Array<Record<string, unknown>> = [
      {
        type: 'input_text',
        text: payload.prompt,
      },
    ];

    if (this.enableInputFile && payload.workbook?.localFilePath) {
      content.push({
        type: 'input_file',
        filename: payload.workbook.fileName,
        file_data: this.toDataUrl(payload.workbook.localFilePath, payload.workbook.mimeType),
      });
    }

    return content;
  }

  private extractOutputText(response: OpenAIResponsePayload) {
    if (typeof response.output_text === 'string' && response.output_text.length > 0) {
      return response.output_text;
    }

    const choiceText =
      response.choices
        ?.flatMap((choice) => {
          const content = choice.message?.content;
          if (typeof content === 'string' && content.length > 0) {
            return [content];
          }

          if (Array.isArray(content)) {
            return content
              .map((part) => part.text)
              .filter((text): text is string => typeof text === 'string' && text.length > 0);
          }

          return [];
        })
        .join('\n')
        .trim() ?? '';

    if (choiceText) {
      return choiceText;
    }

    const chunks =
      response.output
        ?.flatMap((item) => {
          if (typeof item.text === 'string' && item.text.length > 0) {
            return [item.text];
          }

          if (Array.isArray(item.content)) {
            return item.content
              .map((contentItem) => contentItem.text)
              .filter((text): text is string => typeof text === 'string' && text.length > 0);
          }

          return [];
        })
        .filter(Boolean) ?? [];

    return chunks.join('\n');
  }

  private unwrapResponsePayload(payload: OpenAICompatibleEnvelope) {
    const unwrapped = payload.data ?? payload;
    if (!unwrapped.usage && payload.usage) {
      unwrapped.usage = payload.usage;
    }
    return unwrapped;
  }

  private buildLooseSchema(value: unknown): Record<string, unknown> {
    if (Array.isArray(value)) {
      const first = value[0] ?? '';
      return {
        type: 'array',
        items: this.buildLooseSchema(first),
      };
    }

    if (value && typeof value === 'object') {
      const properties = Object.entries(value as Record<string, unknown>).reduce<
        Record<string, unknown>
      >((accumulator, [key, child]) => {
        accumulator[key] = this.buildLooseSchema(child);
        return accumulator;
      }, {});

      return {
        type: 'object',
        additionalProperties: false,
        properties,
        required: Object.keys(properties),
      };
    }

    if (typeof value === 'number') {
      return { type: 'number' };
    }

    if (typeof value === 'boolean') {
      return { type: 'boolean' };
    }

    if (value === null) {
      return {
        type: ['string', 'null'],
      };
    }

    return { type: 'string' };
  }

  private toDataUrl(filePath: string, mimeType: string) {
    const buffer = require('node:fs').readFileSync(filePath) as Buffer;
    return `data:${mimeType};base64,${buffer.toString('base64')}`;
  }

  private isProviderConfigured() {
    return Boolean(this.apiKey);
  }

  private getModelName(tier: AiTaskModelTier) {
    if (tier === 'complex') {
      return this.configService.get<string>('AI_MODEL_COMPLEX') ?? 'gpt-5.6-sol';
    }
    if (tier === 'fast') {
      return this.configService.get<string>('AI_MODEL_FAST') ?? 'gpt-5.6-luna';
    }
    return this.configService.get<string>('AI_MODEL_DEFAULT') ?? 'gpt-5.6-terra';
  }
}

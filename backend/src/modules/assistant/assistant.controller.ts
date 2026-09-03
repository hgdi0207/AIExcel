import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AssistantService } from './assistant.service';
import { AiService } from '../ai/ai.service';
import { FilesService } from '../files/files.service';
import { UsageService } from '../usage/usage.service';
import type { AuthUser } from '../../shared/auth.types';

@Controller('assistant')
export class AssistantController {
  constructor(
    private readonly assistantService: AssistantService,
    private readonly aiService: AiService,
    private readonly filesService: FilesService,
    private readonly usageService: UsageService,
  ) {}

  @Get('threads')
  async threads(
    @Req() request: Request & { user?: AuthUser },
    @Query('workbookId') workbookId?: string,
  ) {
    const user = request.user;
    if (!user) {
      throw new UnauthorizedException('Missing user session');
    }

    return {
      success: true,
      data: {
        items: await this.assistantService.listThreads(user.id, workbookId),
      },
    };
  }

  @Post('threads')
  async createThread(
    @Req() request: Request & { user?: AuthUser },
    @Body() body: { title?: string; workbookId?: string },
  ) {
    const user = request.user;
    if (!user) {
      throw new UnauthorizedException('Missing user session');
    }

    const thread = await this.assistantService.createThread(user.id, body?.title, body?.workbookId);
    return {
      success: true,
      data: {
        thread,
      },
    };
  }

  @Get('threads/:id/messages')
  async messages(@Req() request: Request & { user?: AuthUser }, @Param('id') id: string) {
    const user = request.user;
    if (!user) {
      throw new UnauthorizedException('Missing user session');
    }

    const thread = await this.assistantService.getThread(id, user.id);
    return {
      success: true,
      data: {
        thread,
        messages: await this.assistantService.getMessages(id, user.id),
      },
    };
  }

  @Post('threads/:id/messages/stream')
  async stream(
    @Req() request: Request & { user?: AuthUser },
    @Param('id') id: string,
    @Body('content') content: string,
    @Res() response: Response,
  ) {
    const user = request.user;
    if (!user) {
      throw new UnauthorizedException('Missing user session');
    }

    const safeContent = content?.trim() || 'Tell me about this workbook.';
    await this.assistantService.appendUserMessage(id, user.id, safeContent);

    response.setHeader('Content-Type', 'text/event-stream');
    response.setHeader('Cache-Control', 'no-cache');
    response.setHeader('Connection', 'keep-alive');
    response.flushHeaders();

    const thread = await this.assistantService.getThread(id, user.id);
    const recentMessages = await this.assistantService.getRecentMessages(id, user.id);
    const workbookPreview = thread.workbookId
      ? await this.filesService.getWorkbookPreview(thread.workbookId, user.id)
      : null;
    const aiResult = await this.aiService.generateAssistantReply({
      userId: user.id,
      question: safeContent,
      threadTitle: thread.title,
      recentMessages: recentMessages.map((message: { role: 'user' | 'assistant'; content: string }) => ({
        role: message.role,
        content: message.content,
      })),
      workbook: workbookPreview
        ? {
            workbookId: workbookPreview.workbook.id,
            fileName: workbookPreview.workbook.fileName,
            mimeType: workbookPreview.workbook.mimeType,
            summaryMd: workbookPreview.workbook.summaryMd,
            rowCount: workbookPreview.workbook.rowCount,
            sheetCount: workbookPreview.workbook.sheetCount,
            localFilePath: workbookPreview.workbook.localFilePath,
          }
        : undefined,
    });
    const assistantReply = aiResult.output;
    const assistantMessage = await this.assistantService.appendAssistantMessage(
      id,
      user.id,
      assistantReply,
      aiResult.aiRequestId,
    );
    response.write(
      `event: message.delta\ndata: ${JSON.stringify({
        messageId: assistantMessage.id,
        delta: assistantReply,
      })}\n\n`,
    );
    response.write(
      `event: message.complete\ndata: ${JSON.stringify({
        messageId: assistantMessage.id,
        aiRequestId: aiResult.aiRequestId,
        creditsConsumed: 1,
      })}\n\n`,
    );
    await this.usageService.recordUsage(user.id, 'spreadsheet_assistant', 1, {
      threadId: id,
      messageId: assistantMessage.id,
    });
    response.end();
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  AssistantMessageRecord,
  AssistantThreadRecord,
} from './assistant.types';

@Injectable()
export class AssistantService {
  constructor(private readonly prismaService: PrismaService) {}

  async listThreads(userId: string, workbookId?: string) {
    const threads = await this.prismaService.assistantThread.findMany({
      where: {
        userId,
        workbookId,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });
    return threads.map((thread: (typeof threads)[number]) => this.toThreadRecord(thread));
  }

  async createThread(userId: string, title?: string, workbookId?: string) {
    const thread = await this.prismaService.assistantThread.create({
      data: {
        userId,
        workbookId,
        title: title?.trim() || 'New Chat',
        status: 'active',
      },
    });
    return this.toThreadRecord(thread);
  }

  async getThread(threadId: string, userId: string) {
    const thread = await this.prismaService.assistantThread.findFirst({
      where: {
        id: threadId,
        userId,
      },
    });
    if (!thread) {
      throw new NotFoundException('Thread not found');
    }
    return this.toThreadRecord(thread);
  }

  async getMessages(threadId: string, userId: string) {
    await this.getThread(threadId, userId);
    const messages = await this.prismaService.assistantMessage.findMany({
      where: {
        threadId,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
    return messages.map((message: (typeof messages)[number]) => this.toMessageRecord(message));
  }

  async getRecentMessages(threadId: string, userId: string, limit = 12) {
    await this.getThread(threadId, userId);
    const messages = await this.prismaService.assistantMessage.findMany({
      where: {
        threadId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    });
    return messages
      .reverse()
      .map((message: (typeof messages)[number]) => this.toMessageRecord(message));
  }

  async appendUserMessage(threadId: string, userId: string, content: string) {
    await this.getThread(threadId, userId);
    const message = await this.prismaService.assistantMessage.create({
      data: {
        threadId,
        role: 'user',
        content,
      },
    });
    await this.touchThread(threadId);
    return this.toMessageRecord(message);
  }

  async appendAssistantMessage(
    threadId: string,
    userId: string,
    content: string,
    aiRequestId?: string,
  ) {
    await this.getThread(threadId, userId);
    const message = await this.prismaService.assistantMessage.create({
      data: {
        threadId,
        role: 'assistant',
        content,
        aiRequestId,
      },
    });
    await this.touchThread(threadId);
    return this.toMessageRecord(message);
  }

  private async touchThread(threadId: string) {
    await this.prismaService.assistantThread.update({
      where: { id: threadId },
      data: {
        updatedAt: new Date(),
      },
    });
  }

  private toThreadRecord(thread: {
    id: string;
    userId: string;
    title: string | null;
    workbookId: string | null;
    updatedAt: Date;
  }): AssistantThreadRecord {
    return {
      id: thread.id,
      userId: thread.userId,
      title: thread.title ?? 'New Chat',
      workbookId: thread.workbookId ?? undefined,
      updatedAt: thread.updatedAt.toISOString(),
    };
  }

  private toMessageRecord(message: {
    id: string;
    threadId: string;
    role: string;
    content: string;
    createdAt: Date;
    aiRequestId: string | null;
  }): AssistantMessageRecord {
    return {
      id: message.id,
      threadId: message.threadId,
      role: message.role as 'user' | 'assistant',
      content: message.content,
      createdAt: message.createdAt.toISOString(),
      aiRequestId: message.aiRequestId ?? undefined,
    };
  }
}

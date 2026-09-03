import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { UsageEventRecord, UsageToolType } from './usage.types';

type UsageSummaryWindow = {
  periodStart?: Date | null;
  periodEnd?: Date | null;
};

type EffectiveUsageContext = {
  plan: string;
  periodStart: Date;
  periodEnd: Date;
};

type SubscriptionUsageContextRecord = {
  planCode: string;
  status: string;
  createdAt: Date;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
};

@Injectable()
export class UsageService {
  constructor(private readonly prismaService: PrismaService) {}

  async recordUsage(
    userId: string,
    toolType: UsageToolType,
    creditDelta: number,
    metadata?: Record<string, unknown>,
  ) {
    const now = new Date();
    const monthWindow = this.getMonthWindow(now);
    const event = await this.prismaService.usageEvent.create({
      data: {
        userId,
        toolType: this.toToolType(toolType),
        actionType: creditDelta >= 0 ? 'consume' : 'refund',
        sourceJobId: this.readString(metadata, 'jobId'),
        sourceJobType: this.readString(metadata, 'jobType') ?? toolType,
        creditDelta,
        metadataJson: metadata ?? undefined,
      },
    });

    await this.prismaService.usageCounter.upsert({
      where: {
        userId_metricType_periodType_periodStart: {
          userId,
          metricType: 'credit_total',
          periodType: 'month',
          periodStart: monthWindow.start,
        },
      },
      update: {
        usedCount: {
          increment: Math.max(creditDelta, 0),
        },
        periodEnd: monthWindow.end,
      },
      create: {
        userId,
        metricType: 'credit_total',
        periodType: 'month',
        periodStart: monthWindow.start,
        periodEnd: monthWindow.end,
        usedCount: Math.max(creditDelta, 0),
      },
    });

    return this.toUsageEventRecord(event);
  }

  async getSummary(userId: string, plan: string, window?: UsageSummaryWindow) {
    const total = this.getPlanCredits(plan);
    const effectiveWindow = this.resolveSummaryWindow(window);
    const where = this.buildWindowWhere(userId, effectiveWindow);
    const [aggregate, grouped] = await Promise.all([
      this.prismaService.usageEvent.aggregate({
        where,
        _sum: {
          creditDelta: true,
        },
      }),
      this.prismaService.usageEvent.groupBy({
        by: ['toolType'],
        where,
        _count: {
          toolType: true,
        },
      }),
    ]);
    const used = Math.max(aggregate._sum.creditDelta ?? 0, 0);
    const metrics = grouped.map((item: { toolType: string; _count: { toolType: number } }) => ({
      metricType: item.toolType as UsageToolType,
      usedCount: item._count.toolType,
    }));

    return {
      plan,
      credits: {
        total,
        used,
        remaining: Math.max(total - used, 0),
      },
      metrics,
    };
  }

  async getCurrentSummary(userId: string, fallbackPlan: string) {
    const context = await this.resolveEffectiveUsageContext(userId, fallbackPlan);
    return this.getSummary(userId, context.plan, {
      periodStart: context.periodStart,
      periodEnd: context.periodEnd,
    });
  }

  async getHistory(userId: string, window?: UsageSummaryWindow) {
    const effectiveWindow = window ? this.resolveSummaryWindow(window) : null;
    const events = await this.prismaService.usageEvent.findMany({
      where: {
        userId,
        ...(effectiveWindow
          ? {
              createdAt: {
                gte: effectiveWindow.start,
                lt: effectiveWindow.end,
              },
            }
          : {}),
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 100,
    });
    return events.map((event: (typeof events)[number]) => this.toUsageEventRecord(event));
  }

  async getCurrentHistory(userId: string, fallbackPlan: string) {
    const context = await this.resolveEffectiveUsageContext(userId, fallbackPlan);
    return this.getHistory(userId, {
      periodStart: context.periodStart,
      periodEnd: context.periodEnd,
    });
  }

  private async getEventsForWindow(userId: string, window?: UsageSummaryWindow) {
    const effectiveWindow = this.resolveSummaryWindow(window);
    const events = await this.prismaService.usageEvent.findMany({
      where: this.buildWindowWhere(userId, effectiveWindow),
      orderBy: {
        createdAt: 'desc',
      },
      take: 200,
    });
    return events.map((event: (typeof events)[number]) => this.toUsageEventRecord(event));
  }

  private getPlanCredits(plan: string) {
    const map: Record<string, number> = {
      free: 20,
      pro: 120,
      pro_plus: 300,
    };
    return map[plan] ?? map.free;
  }

  private getMonthWindow(date: Date) {
    const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
    const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
    return { start, end };
  }

  private resolveSummaryWindow(window?: UsageSummaryWindow) {
    const now = new Date();
    if (window?.periodStart && window?.periodEnd && window.periodEnd > window.periodStart) {
      return {
        start: window.periodStart,
        end: window.periodEnd,
      };
    }
    return this.getMonthWindow(now);
  }

  private async resolveEffectiveUsageContext(
    userId: string,
    fallbackPlan: string,
  ): Promise<EffectiveUsageContext> {
    const latestSubscription = await this.prismaService.subscription.findFirst({
      where: {
        userId,
        provider: 'stripe',
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    if (
      latestSubscription &&
      this.isEntitledStatus(latestSubscription.status)
    ) {
      const periodStart = this.maxDate(
        latestSubscription.currentPeriodStart,
        latestSubscription.createdAt,
      );
      const periodEnd =
        latestSubscription.currentPeriodEnd && latestSubscription.currentPeriodEnd > periodStart
          ? latestSubscription.currentPeriodEnd
          : this.addMonths(periodStart, 1);

      return {
        plan: this.normalizePlanCodeToUserPlan(latestSubscription.planCode),
        periodStart,
        periodEnd,
      };
    }

    const monthWindow = this.getMonthWindow(new Date());
    return {
      plan: this.normalizePlanCodeToUserPlan(fallbackPlan),
      periodStart: monthWindow.start,
      periodEnd: monthWindow.end,
    };
  }

  private normalizePlanCodeToUserPlan(plan: string) {
    if (plan === 'pro_plus' || plan === 'pro_plus_monthly') {
      return 'pro_plus';
    }
    if (plan === 'pro' || plan === 'pro_monthly') {
      return 'pro';
    }
    return 'free';
  }

  private isEntitledStatus(status: string) {
    return status === 'active' || status === 'trialing' || status === 'past_due';
  }

  private maxDate(primary: Date | null, fallback: Date) {
    if (!primary) {
      return fallback;
    }
    return primary > fallback ? primary : fallback;
  }

  private addMonths(date: Date, amount: number) {
    const next = new Date(date);
    next.setUTCMonth(next.getUTCMonth() + amount);
    return next;
  }

  private buildWindowWhere(
    userId: string,
    window: {
      start: Date;
      end: Date;
    },
  ) {
    return {
      userId,
      createdAt: {
        gte: window.start,
        lt: window.end,
      },
    };
  }

  private readString(metadata: Record<string, unknown> | undefined, key: string) {
    const value = metadata?.[key];
    return typeof value === 'string' ? value : undefined;
  }

  private toToolType(toolType: UsageToolType) {
    const map = {
      spreadsheet_assistant: 'assistant',
      file_upload: 'file_upload',
      pivot_builder: 'pivot_builder',
      charts: 'charts',
      data_analysis: 'data_analysis',
      reports: 'reports',
    } as const;
    return map[toolType];
  }

  private toUsageEventRecord(event: {
    id: string;
    userId: string;
    toolType: string;
    creditDelta: number;
    createdAt: Date;
    metadataJson: unknown;
  }): UsageEventRecord {
    return {
      id: event.id,
      userId: event.userId,
      toolType: event.toolType as UsageToolType,
      creditDelta: event.creditDelta,
      createdAt: event.createdAt.toISOString(),
      metadata: this.toMetadata(event.metadataJson),
    };
  }

  private toMetadata(value: unknown) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return undefined;
    }
    return value as Record<string, unknown>;
  }
}

import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, SubscriptionStatus, UserPlan } from '@prisma/client';
import { HttpsProxyAgent } from 'https-proxy-agent';
import Stripe from 'stripe';
import { PrismaService } from '../../prisma/prisma.service';
import { UsageService } from '../usage/usage.service';

type BillingPlanDefinition = {
  planCode: string;
  displayName: string;
  description: string;
  amountCents: number;
  currency: string;
  userPlan: UserPlan;
  interval: 'month';
};

const BILLING_PLANS: Record<string, BillingPlanDefinition> = {
  pro_monthly: {
    planCode: 'pro_monthly',
    displayName: 'Pro',
    description: 'For regular spreadsheet work with higher usage limits.',
    amountCents: 900,
    currency: 'usd',
    userPlan: UserPlan.pro,
    interval: 'month',
  },
  pro_plus_monthly: {
    planCode: 'pro_plus_monthly',
    displayName: 'Pro Plus',
    description: 'For heavy spreadsheet usage and larger file workloads.',
    amountCents: 1800,
    currency: 'usd',
    userPlan: UserPlan.pro_plus,
    interval: 'month',
  },
  pro: {
    planCode: 'pro_monthly',
    displayName: 'Pro',
    description: 'For regular spreadsheet work with higher usage limits.',
    amountCents: 900,
    currency: 'usd',
    userPlan: UserPlan.pro,
    interval: 'month',
  },
  pro_plus: {
    planCode: 'pro_plus_monthly',
    displayName: 'Pro Plus',
    description: 'For heavy spreadsheet usage and larger file workloads.',
    amountCents: 1800,
    currency: 'usd',
    userPlan: UserPlan.pro_plus,
    interval: 'month',
  },
};

type BillingSubscriptionSummary = {
  subscriptionStatus: string;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  planCode: string | null;
  amountCents: number | null;
  interval: string | null;
  billingPortalAvailable: boolean;
};

type UsageSummaryResult = {
  plan: string;
  credits: {
    total: number;
    used: number;
    remaining: number;
  };
  metrics: Array<{
    metricType: string;
    usedCount: number;
  }>;
};

type LatestSubscriptionRecord = {
  userId: string;
  providerCustomerId: string | null;
  planCode: string;
  status: SubscriptionStatus;
  createdAt: Date;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  amountCents: number;
  interval: string;
} | null;

@Injectable()
export class BillingService {
  private stripeClient: Stripe | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly prismaService: PrismaService,
    private readonly usageService: UsageService,
  ) {}

  async getBillingSummary(userId: string, userPlan: string): Promise<BillingSubscriptionSummary & UsageSummaryResult> {
    const subscription = await this.getLatestSubscription(userId);
    const effectivePlan = this.resolveEffectivePlan(userPlan, subscription);
    const usageWindow = this.resolveSubscriptionUsageWindow(subscription);
    const usageSummary = await this.usageService.getSummary(userId, effectivePlan, {
      periodStart: usageWindow?.periodStart ?? null,
      periodEnd: usageWindow?.periodEnd ?? null,
    });

    return {
      ...usageSummary,
      plan: effectivePlan,
      subscriptionStatus: subscription?.status ?? 'inactive',
      currentPeriodStart: subscription?.currentPeriodStart?.toISOString() ?? null,
      currentPeriodEnd: subscription?.currentPeriodEnd?.toISOString() ?? null,
      cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd ?? false,
      planCode: subscription?.planCode ?? null,
      amountCents: subscription?.amountCents ?? null,
      interval: subscription?.interval ?? null,
      billingPortalAvailable: Boolean(subscription?.providerCustomerId),
    };
  }

  async createCheckoutSession(user: { id: string; email: string }, planCode: string) {
    const plan = this.resolvePlan(planCode);
    const stripe = this.getStripeClient();
    const frontendOrigin = this.getFrontendOrigin();

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: user.email,
      success_url: `${frontendOrigin}/billing?checkout=success&planCode=${encodeURIComponent(
        plan.planCode,
      )}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${frontendOrigin}/billing?checkout=cancel&planCode=${encodeURIComponent(
        plan.planCode,
      )}`,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: plan.currency,
            unit_amount: plan.amountCents,
            recurring: {
              interval: plan.interval,
            },
            product_data: {
              name: `${plan.displayName} Subscription`,
              description: plan.description,
            },
          },
        },
      ],
      subscription_data: {
        metadata: {
          userId: user.id,
          planCode: plan.planCode,
        },
      },
      metadata: {
        userId: user.id,
        planCode: plan.planCode,
      },
    });

    if (!session.url) {
      throw new InternalServerErrorException('Stripe checkout session is missing a URL.');
    }

    return {
      checkoutUrl: session.url,
      sessionId: session.id,
      planCode: plan.planCode,
    };
  }

  async createBillingPortalSession(userId: string) {
    const subscription = await this.getLatestSubscription(userId);
    if (!subscription?.providerCustomerId) {
      throw new BadRequestException('Billing portal is unavailable for this account.');
    }

    const stripe = this.getStripeClient();
    const frontendOrigin = this.getFrontendOrigin();
    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.providerCustomerId,
      return_url: `${frontendOrigin}/billing`,
    });

    return {
      portalUrl: session.url,
    };
  }

  async processStripeWebhook(rawBody: Buffer | string, signature: string | undefined) {
    const stripe = this.getStripeClient();
    const webhookSecret = this.getWebhookSecret();
    if (!signature) {
      throw new BadRequestException('Missing Stripe signature header.');
    }

    const event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    const existing = await this.prismaService.billingWebhookEvent.findUnique({
      where: {
        provider_providerEventId: {
          provider: 'stripe',
          providerEventId: event.id,
        },
      },
    });
    if (existing) {
      return {
        received: true,
        duplicate: true,
      };
    }

    await this.prismaService.billingWebhookEvent.create({
      data: {
        provider: 'stripe',
        providerEventId: event.id,
        providerSubscriptionId: this.extractSubscriptionId(event as any),
        eventType: event.type,
        payloadJson: event as unknown as Prisma.InputJsonValue,
        status: 'received',
      },
    });

    try {
      const processed = await this.handleStripeEvent(event);
      await this.prismaService.billingWebhookEvent.update({
        where: {
          provider_providerEventId: {
            provider: 'stripe',
            providerEventId: event.id,
          },
        },
        data: {
          status: 'processed',
          processedAt: new Date(),
        },
      });

      return {
        received: true,
        duplicate: false,
        processed,
      };
    } catch (error) {
      await this.prismaService.billingWebhookEvent.update({
        where: {
          provider_providerEventId: {
            provider: 'stripe',
            providerEventId: event.id,
          },
        },
        data: {
          status: 'failed',
          processedAt: new Date(),
        },
      });
      throw error;
    }
  }

  private async handleStripeEvent(event: Stripe.Event) {
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded':
        return this.syncFromCheckoutSession(event.data.object as Stripe.Checkout.Session);
      case 'checkout.session.async_payment_failed':
      case 'checkout.session.expired':
        return this.markCheckoutAttemptFailed(event.data.object as Stripe.Checkout.Session);
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        return this.syncFromSubscription(event.data.object as Stripe.Subscription);
      default:
        return false;
    }
  }

  private async syncFromCheckoutSession(session: Stripe.Checkout.Session) {
    const subscriptionId = this.extractSubscriptionId(session);
    if (!subscriptionId) {
      return false;
    }

    const stripe = this.getStripeClient();
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    return this.persistSubscription(subscription, {
      userId: this.extractUserId(session),
      planCode: this.extractPlanCode(session),
      providerCustomerId: this.extractCustomerId(session) ?? this.extractCustomerId(subscription),
    });
  }

  private async syncFromSubscription(subscription: Stripe.Subscription) {
    return this.persistSubscription(subscription, {
      userId: this.extractUserId(subscription),
      planCode: this.extractPlanCode(subscription),
      providerCustomerId: this.extractCustomerId(subscription),
    });
  }

  private async markCheckoutAttemptFailed(session: Stripe.Checkout.Session) {
    const subscriptionId = this.extractSubscriptionId(session);
    if (!subscriptionId) {
      return false;
    }

    const existing = await this.prismaService.subscription.findFirst({
      where: {
        providerSubscriptionId: subscriptionId,
      },
    });

    if (!existing) {
      return false;
    }

    await this.prismaService.subscription.update({
      where: { id: existing.id },
      data: {
        status: SubscriptionStatus.incomplete,
        cancelAtPeriodEnd: true,
      },
    });

    await this.syncUserPlan(existing.userId, UserPlan.free);
    return true;
  }

  private async persistSubscription(
    subscription: Stripe.Subscription,
    input: {
      userId?: string | null;
      planCode?: string | null;
      providerCustomerId?: string | null;
    },
  ) {
    const plan = this.resolvePlan(input.planCode ?? this.extractPlanCode(subscription) ?? 'pro_monthly');
    const userId =
      input.userId ??
      (await this.lookupExistingSubscriptionUserId(subscription.id)) ??
      this.extractUserId(subscription);

    if (!userId) {
      throw new BadRequestException('Stripe subscription metadata is missing userId.');
    }

    const stripeSubscription = subscription as any;
    const currentPeriodStart = this.toDate(
      stripeSubscription.current_period_start ?? stripeSubscription.currentPeriodStart,
    );
    const currentPeriodEnd = this.toDate(
      stripeSubscription.current_period_end ?? stripeSubscription.currentPeriodEnd,
    );
    const shouldGrantAccess = this.isEntitledStatus(subscription.status);
    const nextPlan = shouldGrantAccess ? plan.userPlan : UserPlan.free;

    const existing = await this.prismaService.subscription.findFirst({
      where: {
        providerSubscriptionId: subscription.id,
      },
    });

    const data = {
      userId,
      provider: 'stripe',
      providerCustomerId: input.providerCustomerId ?? this.extractCustomerId(subscription),
      providerSubscriptionId: subscription.id,
      planCode: plan.planCode,
      status: this.mapStripeSubscriptionStatus(subscription.status),
      currency: subscription.currency,
      amountCents: this.resolveAmountCents(subscription, plan.amountCents),
      interval: plan.interval,
      currentPeriodStart,
      currentPeriodEnd,
      cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
    };

    if (existing) {
      await this.prismaService.subscription.update({
        where: { id: existing.id },
        data,
      });
    } else {
      await this.prismaService.subscription.create({
        data,
      });
    }

    await this.syncUserPlan(userId, nextPlan);
    return true;
  }

  private async syncUserPlan(userId: string, nextPlan: UserPlan) {
    await this.prismaService.user.update({
      where: { id: userId },
      data: {
        plan: nextPlan,
      },
    });
  }

  private async getLatestSubscription(userId: string): Promise<LatestSubscriptionRecord> {
    return this.prismaService.subscription.findFirst({
      where: {
        userId,
        provider: 'stripe',
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });
  }

  private resolveSubscriptionUsageWindow(subscription: LatestSubscriptionRecord) {
    if (!subscription || !this.isEntitledStatus(subscription.status)) {
      return null;
    }

    const periodStart = this.maxDate(
      subscription.currentPeriodStart,
      subscription.createdAt,
    );
    const periodEnd =
      subscription.currentPeriodEnd && subscription.currentPeriodEnd > periodStart
        ? subscription.currentPeriodEnd
        : this.addMonths(periodStart, 1);

    return {
      periodStart,
      periodEnd,
    };
  }

  private async lookupExistingSubscriptionUserId(providerSubscriptionId: string) {
    const record = await this.prismaService.subscription.findFirst({
      where: {
        providerSubscriptionId,
      },
      select: {
        userId: true,
      },
    });
    return record?.userId ?? null;
  }

  private resolveEffectivePlan(userPlan: string, subscription: LatestSubscriptionRecord) {
    if (subscription && this.isEntitledStatus(subscription.status)) {
      return this.resolvePlan(subscription.planCode).userPlan;
    }

    return this.normalizeUserPlan(userPlan);
  }

  private normalizeUserPlan(plan: string) {
    if (plan === UserPlan.pro || plan === 'pro') {
      return UserPlan.pro;
    }
    if (plan === UserPlan.pro_plus || plan === 'pro_plus') {
      return UserPlan.pro_plus;
    }
    return UserPlan.free;
  }

  private resolvePlan(planCode: string) {
    const normalized = this.normalizePlanCode(planCode);
    const plan = BILLING_PLANS[normalized];
    if (!plan) {
      throw new BadRequestException(`Unsupported billing plan: ${planCode}`);
    }
    return plan;
  }

  private normalizePlanCode(planCode: string) {
    if (planCode in BILLING_PLANS) {
      return planCode;
    }
    if (planCode === 'pro') {
      return 'pro_monthly';
    }
    if (planCode === 'pro_plus') {
      return 'pro_plus_monthly';
    }
    return planCode;
  }

  private isEntitledStatus(status: string) {
    return status === 'active' || status === 'trialing' || status === 'past_due';
  }

  private mapStripeSubscriptionStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
    if (status === 'active') {
      return SubscriptionStatus.active;
    }
    if (status === 'trialing') {
      return SubscriptionStatus.trialing;
    }
    if (status === 'past_due') {
      return SubscriptionStatus.past_due;
    }
    if (status === 'canceled') {
      return SubscriptionStatus.canceled;
    }
    if (status === 'unpaid') {
      return SubscriptionStatus.unpaid;
    }
    return SubscriptionStatus.incomplete;
  }

  private resolveAmountCents(subscription: Stripe.Subscription, fallback: number) {
    const stripeSubscription = subscription as any;
    const firstItem = stripeSubscription.items?.data?.[0];
    const unitAmount = firstItem?.price?.unit_amount;
    return typeof unitAmount === 'number' && Number.isFinite(unitAmount) && unitAmount > 0
      ? unitAmount
      : fallback;
  }

  private extractPlanCode(source: any) {
    const planCode = source.metadata?.planCode;
    if (typeof planCode === 'string' && planCode.trim()) {
      return this.normalizePlanCode(planCode.trim());
    }

    const price = source.items?.data[0]?.price as
      | { nickname?: string | null; lookup_key?: string | null }
      | undefined;
    const lookupKey = price?.lookup_key ?? price?.nickname ?? null;
    if (typeof lookupKey === 'string' && lookupKey.trim()) {
      return this.normalizePlanCode(lookupKey.trim());
    }

    return null;
  }

  private extractUserId(source: any) {
    const userId = source.metadata?.userId;
    return typeof userId === 'string' && userId.trim().length > 0 ? userId.trim() : null;
  }

  private extractCustomerId(source: any) {
    const customer = source.customer;
    if (!customer) {
      return null;
    }
    if (typeof customer === 'string') {
      return customer;
    }
    return customer.id;
  }

  private extractSubscriptionId(source: any) {
    const subscription =
      source.subscription ?? source.data?.object?.subscription ?? source.object?.subscription ?? null;
    if (!subscription) {
      return null;
    }
    if (typeof subscription === 'string') {
      return subscription;
    }
    return subscription.id;
  }

  private toDate(value: number | null | undefined) {
    return typeof value === 'number' && value > 0 ? new Date(value * 1000) : null;
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

  private getStripeClient() {
    if (this.stripeClient) {
      return this.stripeClient;
    }

    const secretKey = this.getStripeSecretKey();
    const httpAgent = this.resolveStripeHttpAgent();
    this.stripeClient = httpAgent ? new Stripe(secretKey, { httpAgent }) : new Stripe(secretKey);
    return this.stripeClient;
  }

  private resolveStripeHttpAgent() {
    const nodeEnv = this.configService.get<string>('NODE_ENV') ?? 'development';
    const proxyMode = this.configService.get<string>('OUTBOUND_PROXY_MODE') ?? 'off';
    const proxyUrl = this.configService.get<string>('OUTBOUND_PROXY_URL') ?? '';
    const shouldUseProxy = proxyMode === 'on' || (proxyMode === 'development' && nodeEnv === 'development');

    if (!shouldUseProxy || !proxyUrl.trim()) {
      return null;
    }

    return new HttpsProxyAgent(proxyUrl.trim());
  }

  private getStripeSecretKey() {
    const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY') ?? '';
    if (!secretKey.trim()) {
      throw new InternalServerErrorException('Stripe secret key is not configured.');
    }
    return secretKey.trim();
  }

  private getWebhookSecret() {
    const secret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET') ?? '';
    if (!secret.trim()) {
      throw new InternalServerErrorException('Stripe webhook secret is not configured.');
    }
    return secret.trim();
  }

  private getFrontendOrigin() {
    return (this.configService.get<string>('FRONTEND_ORIGIN') ?? 'http://127.0.0.1:3001').replace(/\/$/, '');
  }
}

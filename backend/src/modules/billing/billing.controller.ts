import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { BillingService } from './billing.service';
import type { AuthUser } from '../../shared/auth.types';
import { Public } from '../../shared/public.decorator';

@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get('summary')
  async summary(@Req() request: Request & { user?: AuthUser }) {
    const user = request.user;
    if (!user) {
      throw new UnauthorizedException('Missing user session');
    }

    return {
      success: true,
      data: await this.billingService.getBillingSummary(user.id, user.plan),
    };
  }

  @Post('checkout')
  async checkout(
    @Req() request: Request & { user?: AuthUser },
    @Body() body: { planCode: string },
  ) {
    const user = request.user;
    if (!user) {
      throw new UnauthorizedException('Missing user session');
    }

    return {
      success: true,
      data: await this.billingService.createCheckoutSession(
        { id: user.id, email: user.email },
        body.planCode,
      ),
    };
  }

  @Post('portal')
  async portal(@Req() request: Request & { user?: AuthUser }) {
    const user = request.user;
    if (!user) {
      throw new UnauthorizedException('Missing user session');
    }

    return {
      success: true,
      data: await this.billingService.createBillingPortalSession(user.id),
    };
  }

  @Post('webhook')
  @Public()
  async webhook(
    @Req() request: Request & { rawBody?: Buffer | string },
    @Headers('stripe-signature') stripeSignature?: string,
  ) {
    const rawBody = request.rawBody;
    if (!rawBody) {
      throw new UnauthorizedException('Missing webhook raw body');
    }

    return {
      success: true,
      data: await this.billingService.processStripeWebhook(rawBody, stripeSignature),
    };
  }
}

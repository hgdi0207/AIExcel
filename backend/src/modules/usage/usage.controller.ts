import { Controller, Get, Req, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { UsageService } from './usage.service';
import type { AuthUser } from '../../shared/auth.types';

@Controller('usage')
export class UsageController {
  constructor(private readonly usageService: UsageService) {}

  @Get('summary')
  async summary(@Req() request: Request & { user?: AuthUser }) {
    const user = request.user;
    if (!user) {
      throw new UnauthorizedException('Missing user session');
    }

    return {
      success: true,
      data: await this.usageService.getCurrentSummary(user.id, user.plan),
    };
  }

  @Get('history')
  async history(@Req() request: Request & { user?: AuthUser }) {
    const user = request.user;
    if (!user) {
      throw new UnauthorizedException('Missing user session');
    }

    return {
      success: true,
      data: {
        items: await this.usageService.getCurrentHistory(user.id, user.plan),
      },
    };
  }
}

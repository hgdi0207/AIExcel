import { Controller, Get, Req, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthUser } from '../../shared/auth.types';

@Controller('dashboard')
export class DashboardController {
  @Get('summary')
  summary(@Req() request: Request & { user?: AuthUser }) {
    const user = request.user;
    if (!user) {
      throw new UnauthorizedException('Missing user session');
    }

    return {
      success: true,
      data: {
        user: {
          name: user.name,
          plan: user.plan,
        },
        credits: {
          total: 20,
          used: 0,
          remaining: 20,
        },
        recentWorkbooks: [],
        recentJobs: [],
      },
    };
  }
}

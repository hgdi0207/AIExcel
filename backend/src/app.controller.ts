import { Controller, Get, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { Public } from './shared/public.decorator';

@Controller()
export class AppController {
  constructor(private readonly configService: ConfigService) {}

  @Get()
  @Public()
  root() {
    return {
      success: true,
      data: {
        name: 'AIExcel backend',
      },
    };
  }

  @Get([
    'login',
    'dashboard',
    'assistant',
    'billing',
    'charts',
    'data-analysis',
    'pivot-builder',
    'reports',
    'usage',
  ])
  @Public()
  redirectFrontendPage(@Req() request: Request, @Res() response: Response) {
    return response.redirect(this.getFrontendUrl(request.originalUrl));
  }

  @Get('favicon.ico')
  @Public()
  favicon(@Res() response: Response) {
    return response.status(204).send();
  }

  private getFrontendUrl(path: string) {
    const frontendOrigin =
      this.configService.get<string>('FRONTEND_ORIGIN') ?? 'http://127.0.0.1:3001';
    return `${frontendOrigin.replace(/\/$/, '')}${path}`;
  }
}

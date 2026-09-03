import {
  Controller,
  Get,
  Logger,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { Public } from '../../shared/public.decorator';
import { REFRESH_TOKEN_COOKIE } from '../../shared/auth.constants';
import type { AuthUser } from '../../shared/auth.types';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  @Get('google')
  @Public()
  google(@Res() response: Response) {
    if (!this.authService.isProviderConfigured('google')) {
      return response.redirect('/api/auth/google/callback?code=demo');
    }
    return response.redirect(this.authService.getProviderAuthorizationUrl('google'));
  }

  @Get('microsoft')
  @Public()
  microsoft(@Res() response: Response) {
    if (!this.authService.isProviderConfigured('microsoft')) {
      return response.redirect('/api/auth/microsoft/callback?code=demo');
    }
    return response.redirect(this.authService.getProviderAuthorizationUrl('microsoft'));
  }

  @Get('google/callback')
  @Public()
  async googleCallback(
    @Res() response: Response,
    @Query('code') code?: string,
    @Query('state') state?: string,
  ) {
    const frontendOrigin = process.env.FRONTEND_ORIGIN ?? 'http://127.0.0.1:3001';
    if (!code) {
      return response.redirect(`${frontendOrigin}/login?error=missing_code`);
    }
    try {
      const user = await this.resolveOAuthUser('google', code, state);
      await this.authService.issueAuthCookies(response, user);
      return response.redirect(`${frontendOrigin}/dashboard`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'google_oauth_failed';
      this.logger.error(`Google OAuth callback failed: ${message}`, error instanceof Error ? error.stack : undefined);
      return response.redirect(
        `${frontendOrigin}/login?error=google_oauth_failed&detail=${encodeURIComponent(message)}`,
      );
    }
  }

  @Get('microsoft/callback')
  @Public()
  async microsoftCallback(
    @Res() response: Response,
    @Query('code') code?: string,
    @Query('state') state?: string,
  ) {
    const frontendOrigin = process.env.FRONTEND_ORIGIN ?? 'http://127.0.0.1:3001';
    if (!code) {
      return response.redirect(`${frontendOrigin}/login?error=missing_code`);
    }
    try {
      const user = await this.resolveOAuthUser('microsoft', code, state);
      await this.authService.issueAuthCookies(response, user);
      return response.redirect(`${frontendOrigin}/dashboard`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'microsoft_oauth_failed';
      this.logger.error(`Microsoft OAuth callback failed: ${message}`, error instanceof Error ? error.stack : undefined);
      return response.redirect(
        `${frontendOrigin}/login?error=microsoft_oauth_failed&detail=${encodeURIComponent(message)}`,
      );
    }
  }

  @Get('me')
  me(@Req() request: Request & { user?: AuthUser }) {
    if (!request.user) {
      throw new UnauthorizedException('Missing user session');
    }

    return {
      success: true,
      data: {
        user: request.user,
      },
    };
  }

  @Post('refresh')
  @Public()
  async refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const refreshToken = request.cookies?.[REFRESH_TOKEN_COOKIE];
    if (!refreshToken) {
      throw new UnauthorizedException('Missing refresh token');
    }

    await this.authService.refreshFromCookie(refreshToken, response);
    return {
      success: true,
      data: {
        refreshed: true,
      },
    };
  }

  @Post('logout')
  @Public()
  logout(@Res({ passthrough: true }) response: Response) {
    this.authService.clearAuthCookies(response);
    return {
      success: true,
      data: {
        loggedOut: true,
      },
    };
  }

  private async resolveOAuthUser(
    provider: 'google' | 'microsoft',
    code: string,
    state?: string,
  ) {
    const useMock =
      code === 'demo' ||
      (provider === 'google'
        ? !process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET
        : !process.env.MICROSOFT_CLIENT_ID || !process.env.MICROSOFT_CLIENT_SECRET);

    if (useMock) {
      return this.authService.ensureMockUser(provider);
    }

    return this.authService.authenticateOAuthCallback(provider, code, state);
  }
}

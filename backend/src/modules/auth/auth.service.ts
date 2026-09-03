import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Response } from 'express';
import { createHash, randomUUID } from 'crypto';
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from '../../shared/auth.constants';
import type { AuthUser, JwtPayload } from '../../shared/auth.types';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  OAuthProviderConfig,
  OAuthProviderName,
  OAuthUserProfile,
} from './oauth.types';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prismaService: PrismaService,
  ) {}

  getProviderAuthorizationUrl(provider: OAuthProviderName) {
    const config = this.getProviderConfig(provider);
    const redirectUri = this.getRedirectUri(provider);
    const state = this.createOAuthState(provider);
    const url = new URL(config.authorizeUrl);

    if (provider === 'google') {
      url.searchParams.set('client_id', config.clientId);
      url.searchParams.set('redirect_uri', redirectUri);
      url.searchParams.set('response_type', 'code');
      url.searchParams.set('scope', config.scopes.join(' '));
      url.searchParams.set('access_type', 'offline');
      url.searchParams.set('prompt', 'consent');
      url.searchParams.set('state', state);
      return url.toString();
    }

    url.searchParams.set('client_id', config.clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('response_mode', 'query');
    url.searchParams.set('scope', config.scopes.join(' '));
    url.searchParams.set('state', state);
    return url.toString();
  }

  isProviderConfigured(provider: OAuthProviderName) {
    const config = this.getProviderConfig(provider);
    return Boolean(config.clientId && config.clientSecret);
  }

  async authenticateOAuthCallback(
    provider: OAuthProviderName,
    code: string,
    state?: string,
  ) {
    this.validateOAuthState(provider, state);
    const profile = await this.fetchOAuthProfile(provider, code);
    const user = await this.upsertOAuthUser(profile);
    return this.toAuthUser(user);
  }

  async ensureMockUser(provider: OAuthProviderName) {
    const profile: OAuthUserProfile = {
      provider,
      providerAccountId: `demo-${provider}`,
      email: 'demo@example.com',
      name: 'Demo User',
      avatarUrl: null,
      accessToken: null,
      refreshToken: null,
      tokenExpiresAt: null,
    };
    const user = await this.upsertOAuthUser(profile);
    return this.toAuthUser(user);
  }

  async issueAuthCookies(response: Response, user: AuthUser) {
    const accessToken = await this.signToken(user, 'access', this.getAccessTtl());
    const refreshToken = await this.signToken(user, 'refresh', this.getRefreshTtl());

    response.cookie(ACCESS_TOKEN_COOKIE, accessToken, this.getCookieOptions(this.getAccessTtl()));
    response.cookie(
      REFRESH_TOKEN_COOKIE,
      refreshToken,
      this.getCookieOptions(this.getRefreshTtl()),
    );
  }

  async refreshFromCookie(refreshToken: string, response: Response) {
    try {
      const payload = await this.verifyToken(refreshToken, 'refresh');
      const user = (await this.findUserById(payload.sub)) ?? this.buildUserFromPayload(payload);
      await this.issueAuthCookies(response, user);
      return user;
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  clearAuthCookies(response: Response) {
    response.clearCookie(ACCESS_TOKEN_COOKIE);
    response.clearCookie(REFRESH_TOKEN_COOKIE);
  }

  private async upsertOAuthUser(profile: OAuthUserProfile) {
    const user = await this.prismaService.user.upsert({
      where: { email: profile.email.toLowerCase() },
      update: {
        name: profile.name || profile.email,
        avatarUrl: profile.avatarUrl,
        plan: 'free',
        locale: 'en',
        timezone: 'Asia/Shanghai',
        lastLoginAt: new Date(),
      },
      create: {
        email: profile.email.toLowerCase(),
        name: profile.name || profile.email,
        avatarUrl: profile.avatarUrl,
        plan: 'free',
        locale: 'en',
        timezone: 'Asia/Shanghai',
        status: 'active',
        lastLoginAt: new Date(),
      },
    });

    await this.prismaService.oAuthAccount.upsert({
      where: {
        provider_providerAccountId: {
          provider: profile.provider,
          providerAccountId: profile.providerAccountId,
        },
      },
      update: {
        userId: user.id,
        providerEmail: profile.email.toLowerCase(),
        accessTokenEncrypted: profile.accessToken ?? undefined,
        refreshTokenEncrypted: profile.refreshToken ?? undefined,
        tokenExpiresAt: profile.tokenExpiresAt ?? undefined,
      },
      create: {
        userId: user.id,
        provider: profile.provider,
        providerAccountId: profile.providerAccountId,
        providerEmail: profile.email.toLowerCase(),
        accessTokenEncrypted: profile.accessToken ?? undefined,
        refreshTokenEncrypted: profile.refreshToken ?? undefined,
        tokenExpiresAt: profile.tokenExpiresAt ?? undefined,
      },
    });

    return user;
  }

  private async signToken(user: AuthUser, tokenType: JwtPayload['tokenType'], expiresIn: string) {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      plan: user.plan,
      locale: user.locale,
      tokenType,
    };

    return this.jwtService.signAsync(payload, {
      expiresIn,
      jwtid: randomUUID(),
      secret: this.getJwtSecret(),
    });
  }

  private async verifyToken(token: string, tokenType: JwtPayload['tokenType']) {
    const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
      secret: this.getJwtSecret(),
    });

    if (payload.tokenType !== tokenType) {
      throw new Error('Invalid token type');
    }

    return payload;
  }

  private buildUserFromPayload(payload: JwtPayload): AuthUser {
    return {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      avatarUrl: null,
      plan: payload.plan,
      locale: payload.locale,
    };
  }

  private async findUserById(userId: string) {
    const user = await this.prismaService.user.findUnique({
      where: { id: userId },
    });
    return user ? this.toAuthUser(user) : null;
  }

  private toAuthUser(user: {
    id: string;
    email: string;
    name: string | null;
    avatarUrl: string | null;
    plan: string;
    locale: string | null;
  }): AuthUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name ?? user.email,
      avatarUrl: user.avatarUrl,
      plan: user.plan,
      locale: user.locale ?? 'en',
    };
  }

  private getJwtSecret() {
    return this.configService.get<string>('JWT_SECRET') ?? 'dev-secret';
  }

  private getAccessTtl() {
    return this.configService.get<string>('ACCESS_TOKEN_TTL') ?? '15m';
  }

  private getRefreshTtl() {
    return this.configService.get<string>('REFRESH_TOKEN_TTL') ?? '30d';
  }

  private getCookieOptions(expiresIn: string) {
    return {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: (this.configService.get<string>('NODE_ENV') ?? 'development') === 'production',
      path: '/',
      maxAge: this.toMilliseconds(expiresIn),
    };
  }

  private toMilliseconds(expiresIn: string) {
    const match = expiresIn.match(/^(\d+)([smhd])$/);
    if (!match) {
      return undefined;
    }
    const value = Number(match[1]);
    const unit = match[2];
    const multiplier =
      unit === 's'
        ? 1000
        : unit === 'm'
          ? 60 * 1000
          : unit === 'h'
            ? 60 * 60 * 1000
            : 24 * 60 * 60 * 1000;
    return value * multiplier;
  }

  private async fetchOAuthProfile(provider: OAuthProviderName, code: string) {
    const config = this.getProviderConfig(provider);
    if (!config.clientId || !config.clientSecret) {
      throw new UnauthorizedException(`${provider} OAuth is not configured`);
    }

    const redirectUri = this.getRedirectUri(provider);
    const tokenResponse = await this.fetchWithDiagnostics(config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const body = await tokenResponse.text();
      this.logger.error(`${provider} token exchange failed: ${body}`);
      throw new UnauthorizedException(`OAuth token exchange failed: ${body}`);
    }

    const tokenPayload = (await tokenResponse.json()) as Record<string, unknown>;
    const accessToken = String(tokenPayload.access_token ?? '');
    if (!accessToken) {
      this.logger.error(`${provider} token exchange succeeded but access_token is missing`);
      throw new UnauthorizedException('OAuth access token is missing');
    }

    const profile =
      provider === 'google'
        ? await this.fetchGoogleProfile(accessToken)
        : await this.fetchMicrosoftProfile(accessToken);

    return {
      ...profile,
      provider,
      accessToken,
      refreshToken:
        typeof tokenPayload.refresh_token === 'string' ? tokenPayload.refresh_token : null,
      tokenExpiresAt: this.toFutureDate(tokenPayload.expires_in),
    } satisfies OAuthUserProfile;
  }

  private async fetchGoogleProfile(accessToken: string) {
    const response = await this.fetchWithDiagnostics('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    if (!response.ok) {
      const body = await response.text();
      this.logger.error(`Google profile fetch failed: ${body}`);
      throw new UnauthorizedException('Failed to fetch Google user profile');
    }

    const profile = (await response.json()) as Record<string, unknown>;
    return {
      provider: 'google' as const,
      providerAccountId: String(profile.sub ?? ''),
      email: String(profile.email ?? ''),
      name: String(profile.name ?? profile.email ?? ''),
      avatarUrl: typeof profile.picture === 'string' ? profile.picture : null,
    };
  }

  private async fetchMicrosoftProfile(accessToken: string) {
    const response = await this.fetchWithDiagnostics('https://graph.microsoft.com/v1.0/me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    if (!response.ok) {
      const body = await response.text();
      this.logger.error(`Microsoft profile fetch failed: ${body}`);
      throw new UnauthorizedException('Failed to fetch Microsoft user profile');
    }

    const profile = (await response.json()) as Record<string, unknown>;
    return {
      provider: 'microsoft' as const,
      providerAccountId: String(profile.id ?? ''),
      email: String(profile.mail ?? profile.userPrincipalName ?? ''),
      name: String(profile.displayName ?? profile.mail ?? profile.userPrincipalName ?? ''),
      avatarUrl: null,
    };
  }

  private getProviderConfig(provider: OAuthProviderName): OAuthProviderConfig {
    if (provider === 'google') {
      return {
        provider,
        clientId: this.configService.get<string>('GOOGLE_CLIENT_ID') ?? '',
        clientSecret: this.configService.get<string>('GOOGLE_CLIENT_SECRET') ?? '',
        authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenUrl: 'https://oauth2.googleapis.com/token',
        scopes: ['openid', 'email', 'profile'],
      };
    }

    return {
      provider,
      clientId: this.configService.get<string>('MICROSOFT_CLIENT_ID') ?? '',
      clientSecret: this.configService.get<string>('MICROSOFT_CLIENT_SECRET') ?? '',
      authorizeUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
      tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      scopes: ['openid', 'email', 'profile', 'User.Read'],
    };
  }

  private getRedirectUri(provider: OAuthProviderName) {
    const frontendOrigin = this.configService.get<string>('FRONTEND_ORIGIN') ?? 'http://127.0.0.1:3001';
    return `${frontendOrigin}/api/auth/${provider}/callback`;
  }

  private createOAuthState(provider: OAuthProviderName) {
    const nonce = randomUUID();
    const digest = createHash('sha256')
      .update(`${provider}:${nonce}:${this.getJwtSecret()}`)
      .digest('hex');
    return `${provider}.${nonce}.${digest}`;
  }

  private validateOAuthState(provider: OAuthProviderName, state?: string) {
    if (!state) {
      return;
    }
    const [providerName, nonce, digest] = state.split('.');
    if (!providerName || !nonce || !digest || providerName !== provider) {
      throw new UnauthorizedException('Invalid OAuth state');
    }

    const expectedDigest = createHash('sha256')
      .update(`${provider}:${nonce}:${this.getJwtSecret()}`)
      .digest('hex');

    if (expectedDigest !== digest) {
      throw new UnauthorizedException('Invalid OAuth state');
    }
  }

  private toFutureDate(expiresIn: unknown) {
    if (typeof expiresIn !== 'number') {
      return null;
    }
    return new Date(Date.now() + expiresIn * 1000);
  }

  private async fetchWithDiagnostics(input: string, init?: RequestInit) {
    try {
      return await fetch(input, init);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'fetch failed';
      const cause =
        error && typeof error === 'object' && 'cause' in error
          ? (error as { cause?: unknown }).cause
          : undefined;
      const causeMessage =
        cause instanceof Error
          ? `${cause.name}: ${cause.message}`
          : cause
            ? String(cause)
            : 'unknown_cause';

      this.logger.error(`Outbound fetch failed for ${input}: ${message}; cause=${causeMessage}`);
      throw new UnauthorizedException(`Outbound fetch failed: ${causeMessage}`);
    }
  }
}

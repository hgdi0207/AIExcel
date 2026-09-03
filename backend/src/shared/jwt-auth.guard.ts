import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { ACCESS_TOKEN_COOKIE, PUBLIC_KEY } from './auth.constants';
import type { AuthUser, JwtPayload } from './auth.types';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prismaService: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const token = this.extractAccessToken(request);

    if (!token) {
      throw new UnauthorizedException('Missing access token');
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.getJwtSecret(),
      });

      if (payload.tokenType !== 'access') {
        throw new UnauthorizedException('Invalid token type');
      }

      request.user = await this.resolveCurrentUser(payload);
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired session');
    }
  }

  private extractAccessToken(request: Request) {
    return request.cookies?.[ACCESS_TOKEN_COOKIE] ?? this.extractBearerToken(request);
  }

  private extractBearerToken(request: Request) {
    const authorization = request.headers.authorization;
    if (!authorization?.startsWith('Bearer ')) {
      return undefined;
    }
    return authorization.slice('Bearer '.length);
  }

  private getJwtSecret() {
    return this.configService.get<string>('JWT_SECRET') ?? 'dev-secret';
  }

  private async resolveCurrentUser(payload: JwtPayload): Promise<AuthUser> {
    const user = await this.prismaService.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user) {
      throw new UnauthorizedException('User session is no longer valid');
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name ?? payload.name,
      avatarUrl: user.avatarUrl,
      plan: user.plan,
      locale: user.locale ?? payload.locale,
    };
  }
}

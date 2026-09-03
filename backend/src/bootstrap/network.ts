import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';

const logger = new Logger('NetworkBootstrap');

export function configureOutboundNetwork(configService: ConfigService) {
  const nodeEnv = configService.get<string>('NODE_ENV') ?? 'development';
  const mode = configService.get<string>('OUTBOUND_PROXY_MODE') ?? 'off';
  const proxyUrl = configService.get<string>('OUTBOUND_PROXY_URL') ?? '';
  const noProxy =
    configService.get<string>('OUTBOUND_NO_PROXY') ?? '127.0.0.1,localhost';

  const shouldUseProxy =
    mode === 'on' || (mode === 'development' && nodeEnv === 'development');

  if (!shouldUseProxy) {
    logger.log(`Outbound proxy disabled. mode=${mode} env=${nodeEnv}`);
    return;
  }

  if (!proxyUrl) {
    logger.warn(
      `Outbound proxy mode is enabled but OUTBOUND_PROXY_URL is empty. mode=${mode} env=${nodeEnv}`,
    );
    return;
  }

  process.env.HTTP_PROXY = proxyUrl;
  process.env.HTTPS_PROXY = proxyUrl;
  process.env.ALL_PROXY = proxyUrl;
  process.env.NO_PROXY = noProxy;
  process.env.NODE_USE_ENV_PROXY = '1';

  logger.log(`Outbound proxy enabled for Node requests. mode=${mode} proxy=${proxyUrl}`);
}

import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Validate critical config at bootstrap time. Called before app.listen().
 * Uses ConfigService (DIP-compliant) instead of process.env.
 */
export function validateStartupConfig(configService: ConfigService): void {
  const logger = new Logger('Bootstrap');

  const jwtSecret = configService.get<string>('JWT_SECRET');
  if (!jwtSecret || jwtSecret.length < 32) {
    logger.warn(
      'JWT_SECRET is missing or shorter than 32 characters. ' +
        'Set a strong secret in production.',
    );
  }
}

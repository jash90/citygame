import { Controller, Get, Inject, Optional } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { REDIS_CLIENT } from '../redis/redis.module';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    @Optional() private readonly prisma?: PrismaService,
    @Optional() @Inject(REDIS_CLIENT) private readonly redis?: Redis,
  ) {}

  @Get()
  async check() {
    const checks: Record<string, string> = {};

    // Database check
    try {
      if (this.prisma) {
        await this.prisma.$queryRaw`SELECT 1`;
        checks.database = 'ok';
      } else {
        checks.database = 'not_configured';
      }
    } catch {
      checks.database = 'error';
    }

    // Redis check
    try {
      if (this.redis) {
        const pong = await this.redis.ping();
        checks.redis = pong === 'PONG' ? 'ok' : 'error';
      } else {
        checks.redis = 'not_configured';
      }
    } catch {
      checks.redis = 'error';
    }

    const allOk = Object.values(checks).every((v) => v === 'ok' || v === 'not_configured');

    return {
      status: allOk ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      checks,
    };
  }
}

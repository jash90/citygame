import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';

/** Metadata key to mark controllers/routes as dev-only. */
export const IS_DEV_ENDPOINT = 'isDevEndpoint';

@Injectable()
export class DevEndpointsGuard implements CanActivate {
  constructor(
    private readonly configService: ConfigService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isDevEndpoint =
      this.reflector.getAllAndOverride<boolean>(IS_DEV_ENDPOINT, [
        context.getHandler(),
        context.getClass(),
      ]) ?? false;

    if (!isDevEndpoint) {
      return true;
    }

    return this.configService.get<string>('ENABLE_DEV_ENDPOINTS') === 'true';
  }
}

import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Request } from 'express';

export interface CurrentUserPayload {
  id: string;
  email: string;
  role: UserRole;
}

interface RequestWithUser extends Request {
  user: CurrentUserPayload;
}

export const CurrentUser = createParamDecorator(
  (data: keyof CurrentUserPayload | undefined, ctx: ExecutionContext): CurrentUserPayload | string => {
    const request = ctx.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;
    return data ? user[data] : user;
  },
);

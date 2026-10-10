import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Admin } from '../admin.entity';

export const CurrentAdmin = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Admin => {
    const request = ctx.switchToHttp().getRequest<{ user: Admin }>();
    return request.user;
  },
);

import { createParamDecorator, ExecutionContext } from '@nestjs/common';

import { PosSession } from '../pos-session.type';

export const CurrentPosSession = createParamDecorator(
  (_data: unknown, context: ExecutionContext): PosSession => {
    const request = context.switchToHttp().getRequest<{ posSession: PosSession }>();
    return request.posSession;
  },
);

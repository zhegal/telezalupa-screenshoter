import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from '../../auth/auth.service.js';

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const sessionId = request.cookies?.[this.authService.getCookieName()];
    const session = await this.authService.getSession(sessionId);

    if (!session) {
      throw new UnauthorizedException('Authentication required');
    }

    return true;
  }
}

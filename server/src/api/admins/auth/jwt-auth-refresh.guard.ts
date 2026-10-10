import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Admin } from '../admin.entity';
import { AuthService } from './auth.service';
import { REFRESH_TOKEN_HEADER } from './auth-headers';

type AuthedRequest = Request & { user?: Admin };

@Injectable()
export class JwtAuthRefreshGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();
    const request = http.getRequest<AuthedRequest>();
    const response = http.getResponse<Response>();

    const accessToken = this.extractBearer(request);
    const refreshHeader = request.headers[REFRESH_TOKEN_HEADER];
    const refreshToken = Array.isArray(refreshHeader)
      ? refreshHeader[0]
      : refreshHeader;

    try {
      const auth = await this.authService.validateOrRefreshAccess(
        accessToken,
        refreshToken,
      );

      request.user = auth.admin;

      if (
        auth.rotated &&
        auth.accessToken &&
        auth.refreshToken &&
        auth.expiresIn !== undefined
      ) {
        this.authService.applyRotatedTokens(response, {
          accessToken: auth.accessToken,
          refreshToken: auth.refreshToken,
          expiresIn: auth.expiresIn,
        });
      }

      return true;
    } catch {
      throw new UnauthorizedException();
    }
  }

  private extractBearer(request: Request): string | undefined {
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      return undefined;
    }
    return header.slice('Bearer '.length).trim() || undefined;
  }
}

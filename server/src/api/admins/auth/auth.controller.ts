import {
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { REFRESH_TOKEN_HEADER } from './auth-headers';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('admins/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Headers('authorization') authorization?: string,
    @Headers(REFRESH_TOKEN_HEADER) refreshToken?: string,
  ): Promise<void> {
    const accessToken = this.extractBearer(authorization);
    if (!accessToken) {
      throw new UnauthorizedException();
    }

    await this.authService.logout(
      accessToken,
      Array.isArray(refreshToken) ? refreshToken[0] : refreshToken,
    );
  }

  private extractBearer(authorization?: string): string | undefined {
    if (!authorization?.startsWith('Bearer ')) {
      return undefined;
    }
    return authorization.slice('Bearer '.length).trim() || undefined;
  }
}

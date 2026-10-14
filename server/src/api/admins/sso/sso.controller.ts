import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthService, GoogleProfile, TokenPair } from '../auth/auth.service';
import { GoogleAuthGuard } from './google-auth.guard';

@ApiTags('admins-sso')
@Controller('admins/sso')
export class SsoController {
  constructor(private readonly authService: AuthService) {}

  @Get('google')
  @UseGuards(GoogleAuthGuard)
  googleAuth(): void {
    // Passport redirects to Google
  }

  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  async googleCallback(
    @Req() req: { user: GoogleProfile },
  ): Promise<TokenPair> {
    return this.authService.loginWithGoogle(req.user);
  }
}

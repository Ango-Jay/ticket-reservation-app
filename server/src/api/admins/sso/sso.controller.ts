import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService, GoogleProfile, TokenPair } from '../auth/auth.service';
import { GoogleAuthGuard } from './google-auth.guard';

@ApiTags('admins-sso')
@Controller('admins/sso')
export class SsoController {
  constructor(private readonly authService: AuthService) {}

  @Get('google')
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({
    summary: 'Start Google SSO',
    description:
      'Browser entry point for admin login. Redirects to Google OAuth. Invite emails also deep-link here.',
  })
  googleAuth(): void {
    // Passport redirects to Google
  }

  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({
    summary: 'Google SSO callback',
    description:
      'OAuth callback (must match `GOOGLE_CALLBACK_URL`). Returns JSON `{ accessToken, refreshToken, expiresIn }` on the API origin — not a SPA redirect. Store both tokens; send `Authorization: Bearer` and `x-refresh-token` on subsequent admin calls.',
  })
  async googleCallback(
    @Req() req: { user: GoogleProfile },
  ): Promise<TokenPair> {
    return this.authService.loginWithGoogle(req.user);
  }
}

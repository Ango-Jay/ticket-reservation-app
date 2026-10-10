import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback, Profile } from 'passport-google-oauth20';
import { Env, EnvironmentVariables } from '../../../config/env';
import { GoogleProfile } from '../auth/auth.service';

function resolveNames(profile: Profile): {
  firstName: string | null;
  lastName: string | null;
} {
  const given = profile.name?.givenName?.trim() || null;
  const family = profile.name?.familyName?.trim() || null;

  if (given || family) {
    return { firstName: given, lastName: family };
  }

  const displayName = profile.displayName?.trim();
  if (!displayName) {
    return { firstName: null, lastName: null };
  }

  const [first, ...rest] = displayName.split(/\s+/);
  return {
    firstName: first || null,
    lastName: rest.length > 0 ? rest.join(' ') : null,
  };
}

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(config: ConfigService<EnvironmentVariables, true>) {
    super({
      clientID: config.getOrThrow(Env.GOOGLE_CLIENT_ID, { infer: true }),
      clientSecret: config.getOrThrow(Env.GOOGLE_CLIENT_SECRET, { infer: true }),
      callbackURL: config.getOrThrow(Env.GOOGLE_CALLBACK_URL, { infer: true }),
      scope: ['email', 'profile'],
    });
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): void {
    const email = profile.emails?.[0]?.value;
    if (!email) {
      done(new Error('Google profile did not include an email'), undefined);
      return;
    }

    const { firstName, lastName } = resolveNames(profile);

    const googleProfile: GoogleProfile = {
      googleSub: profile.id,
      email,
      firstName,
      lastName,
    };

    done(null, googleProfile);
  }
}

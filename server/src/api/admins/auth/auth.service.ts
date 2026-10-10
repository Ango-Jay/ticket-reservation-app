import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { Response } from 'express';
import { MoreThan, Repository } from 'typeorm';
import { Env, EnvironmentVariables } from '../../../config/env';
import { normalizeEmail } from '../../../utils/normalize-email';
import {
  parseDurationToMs,
  parseDurationToSeconds,
} from '../../../utils/parse-duration';
import { Admin } from '../admin.entity';
import { AdminStatus } from '../enums';
import { AdminSession } from './admin-session.entity';
import { AdminTokenBlacklist } from './admin-token-blacklist.entity';
import {
  ACCESS_TOKEN_EXPIRES_IN_HEADER,
  ACCESS_TOKEN_RESPONSE_HEADER,
  REFRESH_TOKEN_RESPONSE_HEADER,
} from './auth-headers';
import { JwtPayload } from './jwt-payload';

export interface GoogleProfile {
  googleSub: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthContext {
  admin: Admin;
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  rotated: boolean;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Admin)
    private readonly adminsRepository: Repository<Admin>,
    @InjectRepository(AdminSession)
    private readonly sessionsRepository: Repository<AdminSession>,
    @InjectRepository(AdminTokenBlacklist)
    private readonly blacklistRepository: Repository<AdminTokenBlacklist>,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  async loginWithGoogle(profile: GoogleProfile): Promise<TokenPair> {
    const email = normalizeEmail(profile.email);
    let admin = await this.adminsRepository.findOne({ where: { email } });

    if (!admin) {
      admin = await this.maybeBootstrapAdmin(email, profile);
    }

    if (!admin) {
      throw new ForbiddenException('Admin is not invited');
    }

    if (admin.status === AdminStatus.Inactive) {
      throw new ForbiddenException('Admin account is inactive');
    }

    admin.googleSub = profile.googleSub;
    admin.status = AdminStatus.Active;
    if (profile.firstName) {
      admin.firstName = profile.firstName;
    }
    if (profile.lastName) {
      admin.lastName = profile.lastName;
    }
    await this.adminsRepository.save(admin);

    return this.issueTokenPair(admin);
  }

  async validateOrRefreshAccess(
    accessToken: string | undefined,
    refreshToken: string | undefined,
  ): Promise<AuthContext> {
    if (accessToken) {
      try {
        const payload = await this.jwtService.verifyAsync<JwtPayload>(
          accessToken,
          {
            secret: this.config.getOrThrow(Env.JWT_SECRET, { infer: true }),
            ignoreExpiration: true,
          },
        );

        if (await this.isBlacklisted(payload.jti)) {
          throw new UnauthorizedException();
        }

        const decoded = this.jwtService.decode(accessToken) as {
          exp?: number;
        } | null;
        const isExpired =
          !decoded?.exp || decoded.exp * 1000 <= Date.now();

        if (!isExpired) {
          const admin = await this.requireActiveAdmin(payload.sub);
          return { admin, rotated: false };
        }
      } catch (error) {
        if (error instanceof UnauthorizedException) {
          throw error;
        }
        if (error instanceof ForbiddenException) {
          throw error;
        }
        // Invalid signature / malformed access — fall through to refresh
      }
    }

    if (!refreshToken) {
      throw new UnauthorizedException();
    }

    return this.refreshFromSession(refreshToken);
  }

  applyRotatedTokens(res: Response, tokens: TokenPair): void {
    res.setHeader(ACCESS_TOKEN_RESPONSE_HEADER, tokens.accessToken);
    res.setHeader(REFRESH_TOKEN_RESPONSE_HEADER, tokens.refreshToken);
    res.setHeader(
      ACCESS_TOKEN_EXPIRES_IN_HEADER,
      String(tokens.expiresIn),
    );
  }

  async logout(
    accessToken: string,
    refreshToken?: string,
  ): Promise<void> {
    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(
        accessToken,
        {
          secret: this.config.getOrThrow(Env.JWT_SECRET, { infer: true }),
          ignoreExpiration: true,
        },
      );

      const decoded = this.jwtService.decode(accessToken) as {
        exp?: number;
      } | null;
      const expiresAt = decoded?.exp
        ? new Date(decoded.exp * 1000)
        : new Date(Date.now() + this.accessTtlMs());

      await this.blacklistRepository.save(
        this.blacklistRepository.create({
          jti: payload.jti,
          expiresAt,
        }),
      );

      if (refreshToken) {
        const hash = this.hashToken(refreshToken);
        await this.sessionsRepository
          .createQueryBuilder()
          .update(AdminSession)
          .set({ revokedAt: new Date() })
          .where('revoked_at IS NULL')
          .andWhere(
            '(token_hash = :hash OR previous_token_hash = :hash)',
            { hash },
          )
          .execute();
      } else {
        await this.sessionsRepository
          .createQueryBuilder()
          .update(AdminSession)
          .set({ revokedAt: new Date() })
          .where('admin_id = :adminId', { adminId: payload.sub })
          .andWhere('revoked_at IS NULL')
          .execute();
      }
    } catch {
      throw new UnauthorizedException();
    }
  }

  async validateJwtPayload(payload: JwtPayload): Promise<Admin> {
    if (await this.isBlacklisted(payload.jti)) {
      throw new UnauthorizedException();
    }
    return this.requireActiveAdmin(payload.sub);
  }

  private async refreshFromSession(refreshToken: string): Promise<AuthContext> {
    const hash = this.hashToken(refreshToken);
    const now = new Date();

    const session = await this.sessionsRepository
      .createQueryBuilder('session')
      .where('session.revoked_at IS NULL')
      .andWhere('session.expires_at > :now', { now })
      .andWhere(
        '(session.token_hash = :hash OR (session.previous_token_hash = :hash AND session.refresh_token_grace_expires_at > :now))',
        { hash, now },
      )
      .getOne();

    if (!session) {
      throw new UnauthorizedException();
    }

    const admin = await this.requireActiveAdmin(session.adminId);
    const tokens = await this.rotateSession(session, admin);

    return {
      admin,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
      rotated: true,
    };
  }

  private async rotateSession(
    session: AdminSession,
    admin: Admin,
  ): Promise<TokenPair> {
    const refreshToken = this.generateRefreshToken();
    const refreshHash = this.hashToken(refreshToken);
    const graceMs = this.config.getOrThrow(Env.JWT_REFRESH_GRACE_MS, {
      infer: true,
    });

    session.previousTokenHash = session.tokenHash;
    session.refreshTokenGraceExpiresAt = new Date(Date.now() + graceMs);
    session.tokenHash = refreshHash;
    session.expiresAt = new Date(Date.now() + this.refreshTtlMs());
    await this.sessionsRepository.save(session);

    const access = await this.signAccessToken(admin);

    return {
      accessToken: access.accessToken,
      refreshToken,
      expiresIn: access.expiresIn,
    };
  }

  private async issueTokenPair(admin: Admin): Promise<TokenPair> {
    const refreshToken = this.generateRefreshToken();
    const session = this.sessionsRepository.create({
      adminId: admin.id,
      tokenHash: this.hashToken(refreshToken),
      previousTokenHash: null,
      refreshTokenGraceExpiresAt: null,
      expiresAt: new Date(Date.now() + this.refreshTtlMs()),
      revokedAt: null,
    });
    await this.sessionsRepository.save(session);

    const access = await this.signAccessToken(admin);

    return {
      accessToken: access.accessToken,
      refreshToken,
      expiresIn: access.expiresIn,
    };
  }

  private async signAccessToken(
    admin: Admin,
  ): Promise<{ accessToken: string; expiresIn: number }> {
    const expiresIn = this.config.getOrThrow(Env.JWT_ACCESS_EXPIRES_IN, {
      infer: true,
    });
    const jti = randomUUID();

    const accessToken = await this.jwtService.signAsync(
      { sub: admin.id, email: admin.email } satisfies Omit<JwtPayload, 'jti'>,
      {
        secret: this.config.getOrThrow(Env.JWT_SECRET, { infer: true }),
        expiresIn: expiresIn as `${number}m`,
        jwtid: jti,
      },
    );

    return {
      accessToken,
      expiresIn: parseDurationToSeconds(expiresIn),
    };
  }

  private async requireActiveAdmin(adminId: string): Promise<Admin> {
    const admin = await this.adminsRepository.findOne({
      where: { id: adminId },
    });

    if (!admin || admin.status !== AdminStatus.Active) {
      throw new UnauthorizedException();
    }

    return admin;
  }

  private async isBlacklisted(jti: string): Promise<boolean> {
    const entry = await this.blacklistRepository.findOne({
      where: {
        jti,
        expiresAt: MoreThan(new Date()),
      },
    });
    return Boolean(entry);
  }

  private async maybeBootstrapAdmin(
    email: string,
    profile: GoogleProfile,
  ): Promise<Admin | null> {
    const adminCount = await this.adminsRepository.count();
    if (adminCount !== 0) {
      return null;
    }

    const bootstrapEmail = this.config.get(Env.ADMIN_BOOTSTRAP_EMAIL, {
      infer: true,
    });
    if (!bootstrapEmail) {
      return null;
    }

    if (normalizeEmail(bootstrapEmail) !== email) {
      return null;
    }

    const admin = this.adminsRepository.create({
      email,
      passwordHash: null,
      googleSub: profile.googleSub,
      firstName: profile.firstName ?? null,
      lastName: profile.lastName ?? null,
      status: AdminStatus.Active,
    });

    return this.adminsRepository.save(admin);
  }

  private generateRefreshToken(): string {
    return randomBytes(48).toString('base64url');
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private accessTtlMs(): number {
    return parseDurationToMs(
      this.config.getOrThrow(Env.JWT_ACCESS_EXPIRES_IN, { infer: true }),
    );
  }

  private refreshTtlMs(): number {
    return parseDurationToMs(
      this.config.getOrThrow(Env.JWT_REFRESH_EXPIRES_IN, { infer: true }),
    );
  }
}

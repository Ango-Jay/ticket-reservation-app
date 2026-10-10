import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Env, EnvironmentVariables } from '../../../config/env';
import { AdminStatus } from '../enums';
import { Admin } from '../admin.entity';
import { normalizeEmail } from '../../../utils/normalize-email';
import { JwtPayload } from './jwt-payload';

export interface GoogleProfile {
  googleSub: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Admin)
    private readonly adminsRepository: Repository<Admin>,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  async loginWithGoogle(profile: GoogleProfile): Promise<{ accessToken: string }> {
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

    const payload: JwtPayload = { sub: admin.id, email: admin.email };
    const accessToken = await this.jwtService.signAsync(payload);

    return { accessToken };
  }

  async validateJwtPayload(payload: JwtPayload): Promise<Admin> {
    const admin = await this.adminsRepository.findOne({
      where: { id: payload.sub },
    });

    if (!admin || admin.status !== AdminStatus.Active) {
      throw new UnauthorizedException();
    }

    return admin;
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
}

import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationService } from '../../common/notification/notification.service';
import { Env, EnvironmentVariables } from '../../config/env';
import { normalizeEmail } from '../../utils/normalize-email';
import { Admin } from './admin.entity';
import { InviteAdminDto } from './dto/invite-admin.dto';
import { UpdateAdminDto } from './dto/update-admin.dto';
import { AdminStatus } from './enums';

@Injectable()
export class AdminsService {
  private readonly logger = new Logger(AdminsService.name);

  constructor(
    @InjectRepository(Admin)
    private readonly adminsRepository: Repository<Admin>,
    private readonly notificationService: NotificationService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  async invite(dto: InviteAdminDto): Promise<Admin> {
    const email = normalizeEmail(dto.email);
    const existing = await this.adminsRepository.findOne({ where: { email } });
    if (existing) {
      throw new ConflictException('Admin with this email already exists');
    }

    const admin = this.adminsRepository.create({
      email,
      passwordHash: null,
      googleSub: null,
      firstName: null,
      lastName: null,
      status: AdminStatus.Pending,
    });

    const saved = await this.adminsRepository.save(admin);

    const callbackUrl = this.config.getOrThrow(Env.GOOGLE_CALLBACK_URL, {
      infer: true,
    });
    const inviteUrl = new URL('/admins/sso/google', callbackUrl).toString();

    this.notificationService
      .sendEmail({
        to: saved.email,
        subject: 'You are invited to Ticket Days',
        template: 'invite-admin',
        context: {
          email: saved.email,
          inviteUrl,
        },
      })
      .catch((err: unknown) => {
        this.logger.error(
          `Invite email failed for ${saved.email}`,
          err instanceof Error ? err.stack : err,
        );
      });

    return saved;
  }

  async findAll(): Promise<Admin[]> {
    return this.adminsRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Admin> {
    const admin = await this.adminsRepository.findOne({ where: { id } });
    if (!admin) {
      throw new NotFoundException('Admin not found');
    }
    return admin;
  }

  async update(id: string, dto: UpdateAdminDto): Promise<Admin> {
    const admin = await this.findOne(id);

    if (dto.firstName !== undefined) {
      admin.firstName = dto.firstName;
    }
    if (dto.lastName !== undefined) {
      admin.lastName = dto.lastName;
    }
    if (dto.status !== undefined) {
      admin.status = dto.status;
    }

    return this.adminsRepository.save(admin);
  }

  async remove(id: string): Promise<void> {
    const admin = await this.findOne(id);
    admin.status = AdminStatus.Inactive;
    await this.adminsRepository.save(admin);
  }
}

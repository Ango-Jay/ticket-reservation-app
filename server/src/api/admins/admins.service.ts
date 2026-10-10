import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdminStatus } from './enums';
import { Admin } from './admin.entity';
import { InviteAdminDto } from './dto/invite-admin.dto';
import { UpdateAdminDto } from './dto/update-admin.dto';
import { normalizeEmail } from '../../utils/normalize-email';

@Injectable()
export class AdminsService {
  constructor(
    @InjectRepository(Admin)
    private readonly adminsRepository: Repository<Admin>,
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

    return this.adminsRepository.save(admin);
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

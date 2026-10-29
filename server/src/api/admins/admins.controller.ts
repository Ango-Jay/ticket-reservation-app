import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Admin } from './admin.entity';
import { AdminsService } from './admins.service';
import { CurrentAdmin } from './auth/current-admin.decorator';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { InviteAdminDto } from './dto/invite-admin.dto';
import { UpdateAdminDto } from './dto/update-admin.dto';

@ApiTags('admins')
@ApiBearerAuth()
@Controller()
export class AdminsController {
  constructor(private readonly adminsService: AdminsService) {}

  @Get('admin/profile')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Get current admin profile',
    description:
      'Admin. Requires Bearer (and `x-refresh-token` for silent refresh). Returns the authenticated admin without sensitive fields.',
  })
  getProfile(@CurrentAdmin() admin: Admin): Admin {
    return admin;
  }

  @Post('admins/invite')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Invite admin',
    description:
      'Admin. Creates a `pending` admin by email and sends an invite linking to Google SSO. The invitee becomes `active` on first successful Google login.',
  })
  invite(@Body() dto: InviteAdminDto): Promise<Admin> {
    return this.adminsService.invite(dto);
  }

  @Get('admins')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'List admins',
    description: 'Admin. Returns all admins including pending and inactive.',
  })
  findAll(): Promise<Admin[]> {
    return this.adminsService.findAll();
  }

  @Put('admins/:id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Update admin',
    description:
      'Admin. Partial update of `firstName`, `lastName`, and/or `status` (`pending` | `active` | `inactive`).',
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAdminDto,
  ): Promise<Admin> {
    return this.adminsService.update(id, dto);
  }

  @Delete('admins/:id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Deactivate admin',
    description:
      'Admin. Soft-deletes by setting `status` to `inactive`. Returns 204.',
  })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.adminsService.remove(id);
  }
}

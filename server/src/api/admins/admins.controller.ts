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
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
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
  getProfile(@CurrentAdmin() admin: Admin): Admin {
    return admin;
  }

  @Post('admins/invite')
  @UseGuards(JwtAuthGuard)
  invite(@Body() dto: InviteAdminDto): Promise<Admin> {
    return this.adminsService.invite(dto);
  }

  @Get('admins')
  @UseGuards(JwtAuthGuard)
  findAll(): Promise<Admin[]> {
    return this.adminsService.findAll();
  }

  @Put('admins/:id')
  @UseGuards(JwtAuthGuard)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAdminDto,
  ): Promise<Admin> {
    return this.adminsService.update(id, dto);
  }

  @Delete('admins/:id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.adminsService.remove(id);
  }
}

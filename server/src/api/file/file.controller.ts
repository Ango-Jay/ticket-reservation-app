import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { nanoid } from 'nanoid';
import { JwtAuthGuard } from '../admins/auth/jwt-auth.guard';
import { FileService } from './file.service';

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

@ApiTags('admin-file')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('admin/file')
export class FileController {
  constructor(private readonly fileService: FileService) {}

  @Post('upload')
  @ApiOperation({
    summary: 'Upload image',
    description:
      'Admin only. Multipart field `file` (jpeg/png/webp/gif, max 5MB). Returns `{ url }` with a Cloudinary-optimized HTTPS delivery URL. Pass that URL as `imageUrl` when creating or updating an event.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_FILE_BYTES },
    }),
  )
  upload(
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<{ url: string }> {
    if (!file) {
      throw new BadRequestException('file is required');
    }
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException(
        'file must be an image (jpeg, png, webp, or gif)',
      );
    }

    return this.fileService.uploadImage({
      buffer: file.buffer,
      contentType: file.mimetype,
      path: `ticketdays/events/${nanoid()}`,
    });
  }
}

import {
  BadGatewayException,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, type UploadApiResponse } from 'cloudinary';
import { Readable } from 'stream';
import { Env, EnvironmentVariables } from '../../../config/env';
import type {
  UploadObjectInput,
  UploadObjectResult,
} from '../ports/storage.port';

@Injectable()
export class CloudinaryStorageService implements OnModuleInit {
  private readonly logger = new Logger(CloudinaryStorageService.name);

  constructor(
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  onModuleInit(): void {
    cloudinary.config({
      cloud_name: this.config.getOrThrow(Env.CLOUDINARY_CLOUD_NAME, {
        infer: true,
      }),
      api_key: this.config.getOrThrow(Env.CLOUDINARY_API_KEY, { infer: true }),
      api_secret: this.config.getOrThrow(Env.CLOUDINARY_API_SECRET, {
        infer: true,
      }),
      secure: true,
    });
  }

  async upload(input: UploadObjectInput): Promise<UploadObjectResult> {
    const result = await this.uploadBuffer(input);
    const url = this.optimizedDeliveryUrl(result);
    return { url };
  }

  private uploadBuffer(input: UploadObjectInput): Promise<UploadApiResponse> {
    return new Promise((resolve, reject) => {
      const upload = cloudinary.uploader.upload_stream(
        {
          resource_type: 'image',
          public_id: input.path,
          overwrite: false,
          unique_filename: false,
        },
        (error, result) => {
          if (error || !result) {
            this.logger.error(
              `Cloudinary upload failed for ${input.path}`,
              error instanceof Error ? error.stack : String(error),
            );
            reject(
              new BadGatewayException('Failed to upload image to storage'),
            );
            return;
          }
          resolve(result);
        },
      );

      Readable.from(input.buffer).pipe(upload);
    });
  }

  /** Prefer auto format/quality delivery URL when Cloudinary returns a secure URL. */
  private optimizedDeliveryUrl(result: UploadApiResponse): string {
    if (result.public_id) {
      return cloudinary.url(result.public_id, {
        secure: true,
        resource_type: 'image',
        fetch_format: 'auto',
        quality: 'auto',
        version: result.version,
      });
    }
    if (result.secure_url) {
      return result.secure_url;
    }
    throw new BadGatewayException('Storage upload returned no URL');
  }
}

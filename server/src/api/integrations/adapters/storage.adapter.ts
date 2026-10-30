import { Injectable } from '@nestjs/common';
import { CloudinaryStorageService } from '../cloudinary/cloudinary-storage.service';
import type {
  StoragePort,
  UploadObjectInput,
  UploadObjectResult,
} from '../ports/storage.port';

@Injectable()
export class StorageAdapter implements StoragePort {
  constructor(
    private readonly cloudinaryStorageService: CloudinaryStorageService,
  ) {}

  upload(input: UploadObjectInput): Promise<UploadObjectResult> {
    return this.cloudinaryStorageService.upload(input);
  }
}

import { Inject, Injectable } from '@nestjs/common';
import {
  STORAGE_PORT,
  type StoragePort,
  type UploadObjectInput,
} from '../integrations/ports/storage.port';

@Injectable()
export class FileService {
  constructor(
    @Inject(STORAGE_PORT)
    private readonly storage: StoragePort,
  ) {}

  uploadImage(input: UploadObjectInput): Promise<{ url: string }> {
    return this.storage.upload(input);
  }
}

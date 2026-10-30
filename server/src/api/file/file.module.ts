import { Module } from '@nestjs/common';
import { AdminsModule } from '../admins/admins.module';
import { StorageAdapter } from '../integrations/adapters/storage.adapter';
import { CloudinaryModule } from '../integrations/cloudinary/cloudinary.module';
import { STORAGE_PORT } from '../integrations/ports/storage.port';
import { FileController } from './file.controller';
import { FileService } from './file.service';

@Module({
  imports: [AdminsModule, CloudinaryModule],
  controllers: [FileController],
  providers: [
    FileService,
    StorageAdapter,
    {
      provide: STORAGE_PORT,
      useExisting: StorageAdapter,
    },
  ],
})
export class FileModule {}

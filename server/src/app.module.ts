import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminsModule } from './api/admins/admins.module';
import { EventsModule } from './api/events/events.module';
import { ReservationsModule } from './api/reservations/reservations.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { envFilePaths } from './config/env';
import { typeOrmAsyncConfig } from './config/typeorm.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: envFilePaths,
    }),
    TypeOrmModule.forRootAsync(typeOrmAsyncConfig),
    EventsModule,
    ReservationsModule,
    AdminsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

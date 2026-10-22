import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WinstonModule } from 'nest-winston';
import { AdminsModule } from './api/admins/admins.module';
import { EventsModule } from './api/events/events.module';
import { PaymentsModule } from './api/payments/payments.module';
import { ReservationsModule } from './api/reservations/reservations.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { createWinstonOptions } from './common/logger/winston.config';
import { NotificationModule } from './common/notification/notification.module';
import { envFilePaths } from './config/env';
import { validateEnv } from './config/env.validation';
import { typeOrmAsyncConfig } from './config/typeorm.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: envFilePaths,
      validate: validateEnv,
    }),
    ScheduleModule.forRoot(),
    WinstonModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: createWinstonOptions,
    }),
    TypeOrmModule.forRootAsync(typeOrmAsyncConfig),
    NotificationModule,
    EventsModule,
    PaymentsModule,
    ReservationsModule,
    AdminsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

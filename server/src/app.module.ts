import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WinstonModule } from 'nest-winston';
import { AdminsModule } from './api/admins/admins.module';
import { EventsModule } from './api/events/events.module';
import { PaymentsModule } from './api/payments/payments.module';
import { ReservationsModule } from './api/reservations/reservations.module';
import { WebhooksModule } from './api/webhooks/webhooks.module';
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
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60_000,
        limit: 100,
      },
    ]), // 100 requests per minute
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
    WebhooksModule,
    AdminsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}

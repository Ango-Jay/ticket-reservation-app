import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { LoggerService } from '@nestjs/common';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { EnvironmentVariables, Env, getCorsOrigins } from './config/env';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService<EnvironmentVariables, true>);
  const logger = app.get<LoggerService>(WINSTON_MODULE_NEST_PROVIDER);

  app.useLogger(logger);
  app.use(helmet());
  app.enableCors({
    origin: getCorsOrigins(config),
    credentials: true,
  });
  app.useGlobalFilters(new AllExceptionsFilter(logger));

  await app.listen(config.getOrThrow(Env.PORT, { infer: true }));
}
bootstrap();

import {
  ClassSerializerInterceptor,
  LoggerService,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory, Reflector } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { EnvironmentVariables, Env, getCorsOrigins } from './config/env';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService<EnvironmentVariables, true>);
  const logger = app.get<LoggerService>(WINSTON_MODULE_NEST_PROVIDER);

  app.useLogger(logger);
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: [`'self'`],
          styleSrc: [`'self'`, `'unsafe-inline'`],
          imgSrc: [`'self'`, 'data:', 'validator.swagger.io'],
          scriptSrc: [`'self'`, `https: 'unsafe-inline'`],
          connectSrc: [`'self'`],
        },
      },
    }),
  );
  app.enableCors({
    origin: getCorsOrigins(config),
    credentials: true,
    exposedHeaders: [
      'X-Access-Token',
      'X-Refresh-Token',
      'X-Access-Token-Expires-In',
    ],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));
  app.useGlobalFilters(new AllExceptionsFilter(logger));

  const nodeEnv = config.getOrThrow(Env.NODE_ENV, { infer: true });
  if (nodeEnv !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Ticket Reservation API')
      .setDescription('Admin, events, and reservation endpoints')
      .setVersion('0.1')
      .addBearerAuth()
      .addApiKey(
        { type: 'apiKey', name: 'x-refresh-token', in: 'header' },
        'refresh-token',
      )
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document);
  }

  const port = config.getOrThrow(Env.PORT, { infer: true });
  await app.listen(port);

  if (nodeEnv !== 'production') {
    logger.log?.(`Swagger docs available at http://localhost:${port}/docs`);
  }
}
bootstrap();

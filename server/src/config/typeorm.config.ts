import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModuleAsyncOptions } from '@nestjs/typeorm';
import { Env, EnvironmentVariables } from './env';

export const typeOrmAsyncConfig: TypeOrmModuleAsyncOptions = {
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService<EnvironmentVariables, true>) => ({
    type: 'postgres' as const,
    url: config.getOrThrow(Env.DATABASE_URL, { infer: true }),
    autoLoadEntities: true,
    synchronize: false,
  }),
};

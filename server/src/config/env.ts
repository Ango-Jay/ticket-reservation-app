import { ConfigService } from '@nestjs/config';
import { config } from 'dotenv';
import { join } from 'path';

/** Repo-root and server-local .env paths (resolved from this file under src/config). */
export const envFilePaths = [
  join(__dirname, '..', '..', '..', '.env'),
  join(__dirname, '..', '..', '.env'),
];

export function loadEnv(): void {
  for (const path of envFilePaths) {
    config({ path });
  }
}

/** Canonical list of application environment variables. */
export const Env = {
  NODE_ENV: 'NODE_ENV',
  PORT: 'PORT',
  DATABASE_URL: 'DATABASE_URL',
  POSTGRES_HOST: 'POSTGRES_HOST',
  POSTGRES_PORT: 'POSTGRES_PORT',
  POSTGRES_USER: 'POSTGRES_USER',
  POSTGRES_PASSWORD: 'POSTGRES_PASSWORD',
  POSTGRES_DB: 'POSTGRES_DB',
  CORS_ORIGINS: 'CORS_ORIGINS',
  LOG_LEVEL: 'LOG_LEVEL',
} as const;

export type EnvKey = (typeof Env)[keyof typeof Env];

export type NodeEnv = 'development' | 'production' | 'test';

export type LogLevel =
  | 'error'
  | 'warn'
  | 'info'
  | 'http'
  | 'verbose'
  | 'debug'
  | 'silly';

export interface EnvironmentVariables {
  NODE_ENV: NodeEnv;
  PORT: number;
  DATABASE_URL: string;
  POSTGRES_HOST: string;
  POSTGRES_PORT: number;
  POSTGRES_USER: string;
  POSTGRES_PASSWORD: string;
  POSTGRES_DB: string;
  /** Comma-separated list of allowed CORS origins. */
  CORS_ORIGINS: string;
  LOG_LEVEL: LogLevel;
}

/** Comma-separated CORS_ORIGINS env → allowed origin list. */
export function getCorsOrigins(
  configService: ConfigService<EnvironmentVariables, true>,
): string[] {
  return configService
    .getOrThrow('CORS_ORIGINS', { infer: true })
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

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
  GOOGLE_CLIENT_ID: 'GOOGLE_CLIENT_ID',
  GOOGLE_CLIENT_SECRET: 'GOOGLE_CLIENT_SECRET',
  GOOGLE_CALLBACK_URL: 'GOOGLE_CALLBACK_URL',
  JWT_SECRET: 'JWT_SECRET',
  JWT_ACCESS_EXPIRES_IN: 'JWT_ACCESS_EXPIRES_IN',
  JWT_REFRESH_EXPIRES_IN: 'JWT_REFRESH_EXPIRES_IN',
  JWT_REFRESH_GRACE_MS: 'JWT_REFRESH_GRACE_MS',
  RESERVATION_HOLD_EXPIRES_IN: 'RESERVATION_HOLD_EXPIRES_IN',
  ADMIN_BOOTSTRAP_EMAIL: 'ADMIN_BOOTSTRAP_EMAIL',
  RESEND_API_KEY: 'RESEND_API_KEY',
  EMAIL_FROM: 'EMAIL_FROM',
  BACHS_API_KEY: 'BACHS_API_KEY',
  BACHS_API_BASE_URL: 'BACHS_API_BASE_URL',
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
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GOOGLE_CALLBACK_URL: string;
  JWT_SECRET: string;
  JWT_ACCESS_EXPIRES_IN: string;
  JWT_REFRESH_EXPIRES_IN: string;
  JWT_REFRESH_GRACE_MS: number;
  RESERVATION_HOLD_EXPIRES_IN: string;
  /** Used only when admins table is empty. */
  ADMIN_BOOTSTRAP_EMAIL?: string;
  RESEND_API_KEY: string;
  EMAIL_FROM: string;
  BACHS_API_KEY: string;
  BACHS_API_BASE_URL: string;
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

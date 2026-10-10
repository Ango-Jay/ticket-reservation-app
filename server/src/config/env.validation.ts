import * as Joi from 'joi';
import { EnvironmentVariables } from './env';

const corsOriginsSchema = Joi.string()
  .required()
  .custom((value: string, helpers) => {
    const origins = value
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);

    if (origins.length === 0) {
      return helpers.error('any.invalid');
    }

    for (const origin of origins) {
      try {
        // eslint-disable-next-line no-new
        new URL(origin);
      } catch {
        return helpers.error('any.invalid');
      }
    }

    return value;
  }, 'comma-separated absolute origins')
  .messages({
    'any.invalid':
      'CORS_ORIGINS must be a non-empty comma-separated list of absolute URLs',
  });

export const envValidationSchema = Joi.object<EnvironmentVariables>({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .required(),
  PORT: Joi.number().port().required(),
  DATABASE_URL: Joi.string()
    .uri({ scheme: ['postgres', 'postgresql'] })
    .required(),
  POSTGRES_HOST: Joi.string().required(),
  POSTGRES_PORT: Joi.number().port().required(),
  POSTGRES_USER: Joi.string().required(),
  POSTGRES_PASSWORD: Joi.string().required(),
  POSTGRES_DB: Joi.string().required(),
  CORS_ORIGINS: corsOriginsSchema,
  LOG_LEVEL: Joi.string()
    .valid('error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly')
    .required(),
});

export function validateEnv(
  config: Record<string, unknown>,
): EnvironmentVariables {
  const { error, value } = envValidationSchema.validate(config, {
    abortEarly: false,
    allowUnknown: true,
  });

  if (error) {
    throw new Error(`Environment validation failed: ${error.message}`);
  }

  return value;
}

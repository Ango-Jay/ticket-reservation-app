import { ConfigService } from '@nestjs/config';
import { utilities as nestWinstonModuleUtilities, WinstonModuleOptions } from 'nest-winston';
import { format, transports } from 'winston';
import { Env, EnvironmentVariables } from '../../config/env';

export function createWinstonOptions(
  config: ConfigService<EnvironmentVariables, true>,
): WinstonModuleOptions {
  const nodeEnv = config.getOrThrow(Env.NODE_ENV, { infer: true });
  const level = config.getOrThrow(Env.LOG_LEVEL, { infer: true });
  const isProduction = nodeEnv === 'production';

  return {
    level,
    transports: [
      new transports.Console({
        format: isProduction
          ? format.combine(format.timestamp(), format.errors({ stack: true }), format.json())
          : format.combine(
              format.timestamp(),
              format.ms(),
              nestWinstonModuleUtilities.format.nestLike('TicketReservation', {
                colors: true,
                prettyPrint: true,
              }),
            ),
      }),
    ],
  };
}

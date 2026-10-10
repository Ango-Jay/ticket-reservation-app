import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Env, EnvironmentVariables } from '../../config/env';
import { Admin } from './admin.entity';
import { AdminsController } from './admins.controller';
import { AdminsService } from './admins.service';
import { AuthService } from './auth/auth.service';
import { JwtStrategy } from './auth/jwt.strategy';
import { GoogleStrategy } from './sso/google.strategy';
import { SsoController } from './sso/sso.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Admin]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables, true>) => ({
        secret: config.getOrThrow(Env.JWT_SECRET, { infer: true }),
        signOptions: {
          expiresIn: config.getOrThrow(Env.JWT_EXPIRES_IN, {
            infer: true,
          }) as `${number}d`,
        },
      }),
    }),
  ],
  controllers: [AdminsController, SsoController],
  providers: [
    AdminsService,
    AuthService,
    JwtStrategy,
    GoogleStrategy,
  ],
  exports: [TypeOrmModule, JwtModule, AuthService],
})
export class AdminsModule {}

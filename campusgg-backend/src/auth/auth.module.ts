import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';

import { User } from '../users/user.entity';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LoginController } from './login.controller';
import { LoginService } from './login.service';
import { MailService } from './mail.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),

    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: '1h' as const,
        },
      }),
    }),
  ],

  controllers: [AuthController, LoginController],

  providers: [AuthService, LoginService, MailService],

  exports: [AuthService, MailService, JwtModule],
})
export class AuthModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';
import { User } from '../users/user.entity';
import { SteamApiService } from './steam-api.service';
import { SteamController } from './steam.controller';
import { SteamOpenIdService } from './steam-openid.service';
import { SteamService } from './steam.service';

@Module({
  imports: [TypeOrmModule.forFeature([User]), AuthModule],
  controllers: [SteamController],
  providers: [SteamService, SteamOpenIdService, SteamApiService],
  exports: [SteamService],
})
export class SteamModule {}

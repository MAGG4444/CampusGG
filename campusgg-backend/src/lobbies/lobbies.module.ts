import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UsersModule } from '../users/users.module';
import { Lobby } from './lobby.entity';
import { LobbyMember } from './lobby-member.entity';
import { LobbiesController } from './lobbies.controller';
import { LobbiesService } from './lobbies.service';

@Module({
  imports: [TypeOrmModule.forFeature([Lobby, LobbyMember]), UsersModule],
  controllers: [LobbiesController],
  providers: [LobbiesService],
  exports: [LobbiesService],
})
export class LobbiesModule {}

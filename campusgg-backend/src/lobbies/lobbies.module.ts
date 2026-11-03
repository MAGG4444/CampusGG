import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UsersModule } from '../users/users.module';
import { Lobby } from './lobby.entity';
import { LobbyMember } from './lobby-member.entity';
import { LobbiesController } from './lobbies.controller';
import { LobbiesService } from './lobbies.service';
import { AuthModule } from '../auth/auth.module';
import { LobbyMessage } from './lobby-message.entity';
import { LobbyChatService } from './lobby-chat.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Lobby, LobbyMember, LobbyMessage]),
    UsersModule,
    AuthModule,
  ],
  controllers: [LobbiesController],
  providers: [LobbiesService, LobbyChatService],
  exports: [LobbiesService],
})
export class LobbiesModule {}

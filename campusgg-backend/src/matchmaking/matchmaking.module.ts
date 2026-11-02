/**
 * @file matchmaking.module.ts
 * @description NestJS module wiring for the PostgreSQL-backed queue.
 *
 * Imports LobbiesModule (to create lobbies from match groups) and AuthModule
 * (to make JwtService available to the route guard). MatchmakingEntry is
 * registered here so autoLoadEntities includes it.
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module.js';
import { LobbiesModule } from '../lobbies/lobbies.module.js';

import { MatchmakingEntry } from './entities/matchmaking-entry.entity.js';
import { MatchmakingRepository } from './matchmaking.repository.js';
import { MatchmakingService } from './matchmaking.service.js';
import { MatchmakingController } from './matchmaking.controller.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([MatchmakingEntry]),
    LobbiesModule,
    AuthModule,
  ],
  providers: [MatchmakingRepository, MatchmakingService],
  controllers: [MatchmakingController],
  exports: [MatchmakingService],
})
export class MatchmakingModule {}

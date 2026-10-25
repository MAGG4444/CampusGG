/**
 * @file matchmaking.module.ts
 * @description NestJS module wiring the MatchmakingService and its controller.
 *
 * Imports LobbiesModule (to create lobbies from match groups) and
 * UsersModule (to verify enrolled members exist).
 */

import { Module } from '@nestjs/common';

import { LobbiesModule } from '../lobbies/lobbies.module.js';
import { UsersModule } from '../users/users.module.js';

import { MatchmakingService } from './matchmaking.service.js';
import { MatchmakingController } from './matchmaking.controller.js';

@Module({
  imports: [LobbiesModule, UsersModule],
  providers: [MatchmakingService],
  controllers: [MatchmakingController],
  exports: [MatchmakingService],
})
export class MatchmakingModule {}

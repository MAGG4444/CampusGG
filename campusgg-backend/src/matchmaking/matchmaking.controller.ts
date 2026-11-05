/**
 * @file matchmaking.controller.ts
 * @description REST endpoints for the matchmaking flow.
 *
 *   POST /matchmaking/enqueue   — join the queue for a game
 *   GET  /matchmaking/match-status  — poll: has the current user been matched?
 *   POST /matchmaking/process   — manual processQueue tick (testing)
 */

import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard';

import { MatchmakingService } from './matchmaking.service.js';
import type { PlayerMatchmakingInput } from './schemas/player-matchmaking.schema.js';

@Controller('matchmaking')
@UseGuards(JwtAuthGuard)
export class MatchmakingController {
  constructor(private readonly matchmakingService: MatchmakingService) {}

  @Post('enqueue')
  enqueue(
    @Body() player: PlayerMatchmakingInput,
    @Req() request: AuthenticatedRequest,
  ) {
    this.matchmakingService.enqueue({ ...player, userId: request.user!.id });
    return { ok: true };
  }

  @Get('match-status')
  getMatchStatus(@Req() request: AuthenticatedRequest) {
    return this.matchmakingService.getMatchStatus(request.user!.id);
  }

  @Post('process')
  processQueue() {
    this.matchmakingService.processQueue();
    return { ok: true };
  }

  @Post('dequeue')
  dequeue(@Req() request: AuthenticatedRequest) {
    return this.matchmakingService.dequeue(request.user!.id);
  }
}

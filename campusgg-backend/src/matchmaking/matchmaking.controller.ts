/**
 * @file matchmaking.controller.ts
 * @description REST endpoints for the matchmaking flow.
 *
 *   POST /matchmaking/enqueue   — join the queue for a game
 *   GET  /matchmaking/match-status  — poll: has the current user been matched?
 *   POST /matchmaking/process   — manual processQueue tick (testing)
 */

import { Body, Controller, Get, Post, Query } from '@nestjs/common';

import { MatchmakingService } from './matchmaking.service.js';
import type { PlayerMatchmakingInput } from './schemas/player-matchmaking.schema.js';

@Controller('matchmaking')
export class MatchmakingController {
  constructor(private readonly matchmakingService: MatchmakingService) {}

  @Post('enqueue')
  enqueue(@Body() player: PlayerMatchmakingInput) {
    this.matchmakingService.enqueue(player);
    return { ok: true };
  }

  @Get('match-status')
  getMatchStatus(@Query('userId') userId: string) {
    return this.matchmakingService.getMatchStatus(userId);
  }

  @Post('process')
  processQueue() {
    this.matchmakingService.processQueue();
    return { ok: true };
  }

  @Post('dequeue')
  dequeue(@Body('userId') userId: string) {
    const removed = this.matchmakingService.dequeue(userId);
    return { ok: true, removed };
  }
}

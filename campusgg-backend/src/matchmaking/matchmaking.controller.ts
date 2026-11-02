/**
 * @file matchmaking.controller.ts
 * @description REST endpoints for the matchmaking flow.
 *
 *   POST /matchmaking/enqueue       — join the queue for a game
 *   GET  /matchmaking/match-status  — poll: queued, matched, or neither
 *   POST /matchmaking/process       — manual tick (development/test only)
 *   POST /matchmaking/dequeue       — leave the queue
 *
 * Every route requires a valid JWT. The user identity always comes from the
 * token, never from the request body or query string.
 */

import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard.js';

import { MatchmakingService } from './matchmaking.service.js';
import { EnqueueMatchmakingDto } from './dto/enqueue-matchmaking.dto.js';
import { GAME_ROLES } from './engine/game-tiers.config.js';
import type { PlayerMatchmakingInput } from './schemas/player-matchmaking.schema.js';

@Controller('matchmaking')
@UseGuards(JwtAuthGuard)
export class MatchmakingController {
  constructor(
    private readonly matchmakingService: MatchmakingService,
    private readonly configService: ConfigService,
  ) {}

  @Post('enqueue')
  async enqueue(
    @Body() dto: EnqueueMatchmakingDto,
    @Req() request: AuthenticatedRequest,
  ) {
    const userId = this.getAuthenticatedUserId(request);
    this.validateDto(dto);

    const player: PlayerMatchmakingInput = {
      userId,
      game: dto.game,
      profile: dto.profile,
      stats: dto.stats,
      preferences: dto.preferences,
      intensity: dto.intensity,
    };

    const added = await this.matchmakingService.enqueue(player);

    if (!added) {
      throw new ConflictException('You are already in the matchmaking queue.');
    }

    return { ok: true };
  }

  @Get('match-status')
  async getMatchStatus(@Req() request: AuthenticatedRequest) {
    return this.matchmakingService.getMatchStatus(
      this.getAuthenticatedUserId(request),
    );
  }

  @Post('process')
  async processQueue() {
    // Deterministic ticks are a development/test affordance. Production
    // relies on the scheduler (or an external worker) only.
    if (this.configService.get<string>('NODE_ENV') === 'production') {
      throw new ForbiddenException(
        'Manual matchmaking ticks are disabled in production.',
      );
    }

    await this.matchmakingService.processQueue();
    return { ok: true };
  }

  @Post('dequeue')
  async dequeue(@Req() request: AuthenticatedRequest) {
    const removed = await this.matchmakingService.dequeue(
      this.getAuthenticatedUserId(request),
    );

    return { ok: true, removed };
  }

  // ── Internal helpers ──────────────────────────────────────────────────

  private getAuthenticatedUserId(request: AuthenticatedRequest): string {
    const userId = request.user?.id;

    if (!userId) {
      throw new UnauthorizedException();
    }

    return userId;
  }

  private validateDto(dto: EnqueueMatchmakingDto): void {
    if (dto.stats.game !== dto.game) {
      throw new BadRequestException('stats.game must match game.');
    }

    const roles = GAME_ROLES[dto.game];

    if (roles.length > 0) {
      if (!roles.includes(dto.preferences.primaryRole)) {
        throw new BadRequestException(
          `primaryRole must be one of: ${roles.join(', ')}.`,
        );
      }

      if (!roles.includes(dto.preferences.secondaryRole)) {
        throw new BadRequestException(
          `secondaryRole must be one of: ${roles.join(', ')}.`,
        );
      }
    } else if (dto.preferences.primaryRole || dto.preferences.secondaryRole) {
      throw new BadRequestException(
        `${dto.game} does not use roles; leave role fields empty.`,
      );
    }
  }
}

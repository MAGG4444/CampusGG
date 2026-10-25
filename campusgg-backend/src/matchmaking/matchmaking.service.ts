/**
 * @file matchmaking.service.ts
 * @description Matchmaking service — bridge between the MatchmakingEngine
 *              and the Lobbies service.
 *
 * Owns a singleton MatchmakingEngine instance. On every processQueue tick,
 * when the engine forms a MatchGroup, the onMatchFound callback creates a
 * real Lobby via LobbiesService and records the lobbyId so the frontend can
 * poll and redirect the matched players to /lobby/:lobbyId.
 *
 * Boundary responsibilities:
 *   - Does NOT implement scoring math (delegated to MatchStrategy)
 *   - Does NOT persist lobby state (owned by LobbiesService)
 *   - Does NOT manage WebSocket/push (polling endpoint used instead)
 */

import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';

import type { MatchGroup } from './schemas/match-group.schema.js';
import type { PlayerMatchmakingInput } from './schemas/player-matchmaking.schema.js';
import {
  MatchmakingEngine,
  OnMatchFoundCallback,
} from './engine/matchmaking-engine.js';
import { getScoringStrategy } from './engine/strategy-registry.js';

import { LobbiesService } from '../lobbies/lobbies.service.js';
import { LobbyVisibility } from '../lobbies/lobby.entity.js';
import { UsersService } from '../users/users.service.js';

// ─────────────────────────────────────────────────────────────────────────────
// Matchmaking service
// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class MatchmakingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MatchmakingService.name);

  /** The singleton engine instance (created in onModuleInit). */
  private engine: MatchmakingEngine;

  /** Poll interval handle for processQueue. */
  private intervalId: NodeJS.Timeout | null = null;

  /**
   * userId -> { lobbyId, game } for matched players waiting to be picked up
   * by the frontend via GET /matchmaking/match-status.
   */
  private readonly matchResults = new Map<
    string,
    { lobbyId: string; game: string }
  >();

  constructor(
    private readonly lobbiesService: LobbiesService,
    private readonly usersService: UsersService,
  ) {}

  // ── NestJS lifecycle ──────────────────────────────────────────────────

  onModuleInit(): void {
    // One engine instance, shared across all enqueue/processQueue calls.
    // The engine partitions internally by game; one scoring strategy is used
    // for all partitions (CS2's CompetitiveScoringStrategy covers the
    // competitive titles; CasualScoringStrategy covers It Takes Two).
    this.engine = new MatchmakingEngine({
      strategy: getScoringStrategy('CS2'),
      onMatchFound: this.handleMatchFound.bind(this) as OnMatchFoundCallback,
    });

    // Run the queue loop every 3 seconds so matches form without a
    // dedicated worker process. Adjust interval as needed for production.
    this.intervalId = setInterval(() => {
      try {
        this.engine.processQueue();
      } catch (error) {
        this.logger.error('processQueue tick failed', error);
      }
    }, 3000);

    this.logger.log('Matchmaking service initialized');
  }

  onModuleDestroy(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.logger.log('Matchmaking service destroyed');
  }

  // ── Public API ────────────────────────────────────────────────────────

  /**
   * Add a player to the matchmaking queue.
   * Duplicate user IDs within the same game are rejected by the engine.
   */
  enqueue(player: PlayerMatchmakingInput): void {
    this.engine.enqueue(player);
  }

  /**
   * Manually trigger a queue processing tick.
   * Useful for testing or on-demand matching.
   */
  processQueue(): void {
    this.engine.processQueue();
  }

  /**
   * Remove a player from the matchmaking queue by user ID.
   */
  dequeue(userId: string): boolean {
    return this.engine.dequeue(userId);
  }

  /**
   * Check whether a user has been matched and, if so, return the lobby ID.
   * Consumes the result so the frontend only receives it once.
   */
  getMatchStatus(userId: string): {
    matched: boolean;
    lobbyId?: string;
  } {
    const result = this.matchResults.get(userId);
    if (result) {
      this.matchResults.delete(userId);
      return { matched: true, lobbyId: result.lobbyId };
    }
    return { matched: false };
  }

  // ── Internal: match found → lobby creation ────────────────────────────

  /**
   * Callback fired by the engine whenever a MatchGroup passes the threshold.
   * Creates a lobby, enrolls all matched players as members, and records the
   * lobbyId for each user so the frontend can redirect them.
   */
  private async handleMatchFound(matchGroup: MatchGroup): Promise<void> {
    try {
      const hostUserId = matchGroup.userIds[0];

      const lobby = await this.lobbiesService.create(
        {
          lobbyName: `${matchGroup.game} Squad`,
          subtitle: `Matched via CampusGG`,
          details: `Auto-matched group · compatibility ${(
            matchGroup.score * 100
          ).toFixed(0)}% · ${matchGroup.userIds.length} players`,
          game: matchGroup.game,
          participantLimit: matchGroup.userIds.length,
          visibility: LobbyVisibility.PRIVATE,
          tags: ['matchmaking'],
        },
        hostUserId,
      );

      // Enroll the remaining matched players as members.
      const remaining = matchGroup.userIds.slice(1);
      if (remaining.length > 0) {
        await this.lobbiesService.addMembers(lobby.id, remaining);
      }

      // Record the result for every player in the group.
      for (const userId of matchGroup.userIds) {
        this.matchResults.set(userId, {
          lobbyId: lobby.id,
          game: matchGroup.game,
        });
      }

      this.logger.log(
        `Match ${matchGroup.groupId} → lobby ${lobby.id} ` +
          `(${matchGroup.userIds.length} players, score ${matchGroup.score.toFixed(2)})`,
      );
    } catch (error) {
      this.logger.error(
        'Failed to create lobby from match group',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}

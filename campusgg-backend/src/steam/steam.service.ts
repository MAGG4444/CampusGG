import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { RedisService } from '../redis/redis.service';
import { User } from '../users/user.entity';
import { SteamApiService } from './steam-api.service';
import {
  SteamOpenIdService,
  type SteamCallbackQuery,
} from './steam-openid.service';
import { SteamLinkError } from './steam-link.error';
import type {
  CachedSteamStats,
  SteamStatsQueryDto,
  SteamStatsResponse,
} from './dto/steam-stats.dto';

const STATS_TTL_SECONDS = 45 * 60;
const PRIVATE_STATS_TTL_SECONDS = 5 * 60;

@Injectable()
export class SteamService {
  private readonly logger = new Logger(SteamService.name);
  private readonly frontendBaseUrl: string;

  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly openIdService: SteamOpenIdService,
    private readonly steamApiService: SteamApiService,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {
    const configured = this.configService
      .get<string>('FRONTEND_BASE_URL')
      ?.trim();

    this.frontendBaseUrl = this.normalizeBaseUrl(
      configured || 'http://localhost:5173',
    );
  }

  createLinkUrl(userId: string): Promise<{ url: string }> {
    return this.openIdService.createLinkUrl(userId);
  }

  async handleCallback(query: SteamCallbackQuery): Promise<string> {
    try {
      const { userId, steamId } =
        await this.openIdService.verifyCallback(query);

      await this.linkSteamAccount(userId, steamId);

      return this.profileRedirect({ steam: 'linked' });
    } catch (error) {
      const reason =
        error instanceof SteamLinkError ? error.reason : 'unexpected';
      const message =
        error instanceof Error ? error.message : String(error);

      if (error instanceof SteamLinkError) {
        this.logger.warn(`Steam link failed (${reason}): ${message}`);
      } else {
        this.logger.error(
          'Unexpected Steam link failure',
          error instanceof Error ? error.stack : String(error),
        );
      }

      return this.profileRedirect({ steam: 'error', reason });
    }
  }

  async unlinkSteam(userId: string): Promise<{ status: 'NOT_LINKED' }> {
    const user = await this.usersRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.steamId) {
      await this.usersRepository.update(userId, {
        steamId: null,
        steamLinkedAt: null,
        steamSyncedAt: null,
        steamCs2PlaytimeMinutes: null,
        steamDota2PlaytimeMinutes: null,
      });
      await this.redisService.tryDelete(this.statsKey(userId));
    }

    return { status: 'NOT_LINKED' };
  }

  async getStats(
    userId: string,
    query: SteamStatsQueryDto,
  ): Promise<SteamStatsResponse> {
    const user = await this.usersRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const steamId = user.steamId;

    if (!steamId) {
      return { status: 'NOT_LINKED' };
    }

    const cacheKey = this.statsKey(userId);
    const top = this.clampTop(query.top);

    if (!query.refresh) {
      const cached = await this.readCache(cacheKey);

      if (cached) {
        return this.toResponse(user, steamId, cached, true, top);
      }
    }

    try {
      const snapshot = await this.steamApiService.getOwnedGames(steamId);
      const cached: CachedSteamStats = {
        ...snapshot,
        fetchedAt: new Date().toISOString(),
      };

      await this.redisService.trySet(
        cacheKey,
        JSON.stringify(cached),
        snapshot.status === 'OK'
          ? STATS_TTL_SECONDS
          : PRIVATE_STATS_TTL_SECONDS,
      );

      if (snapshot.status === 'OK') {
        try {
          await this.usersRepository.update(userId, {
            steamSyncedAt: new Date(),
            steamCs2PlaytimeMinutes:
              snapshot.cs2?.playtimeForeverMinutes ?? null,
            steamDota2PlaytimeMinutes:
              snapshot.dota2?.playtimeForeverMinutes ?? null,
          });
        } catch (error) {
          this.logger.warn(
            `Could not persist Steam playtime for user ${userId}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      }

      return this.toResponse(user, steamId, cached, false, top);
    } catch (error) {
      this.logger.error(
        `Steam stats fetch failed for user ${userId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );

      return {
        status: 'UNAVAILABLE',
        steamId,
        profileUrl: this.profileUrl(steamId),
        linkedAt: user.steamLinkedAt?.toISOString() ?? null,
        cached: false,
        message:
          'Steam is temporarily unavailable. Please try again shortly.',
      };
    }
  }

  private async linkSteamAccount(
    userId: string,
    steamId: string,
  ): Promise<void> {
    const user = await this.usersRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new SteamLinkError(
        'user_not_found',
        'CampusGG user not found',
      );
    }

    if (user.steamId === steamId) {
      return;
    }

    const existing = await this.usersRepository.findOne({
      where: { steamId },
    });

    if (existing && existing.id !== userId) {
      throw new SteamLinkError(
        'already_linked',
        'This Steam account is already linked to another CampusGG user',
      );
    }

    try {
      await this.usersRepository.update(userId, {
        steamId,
        steamLinkedAt: new Date(),
        steamSyncedAt: null,
        steamCs2PlaytimeMinutes: null,
        steamDota2PlaytimeMinutes: null,
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new SteamLinkError(
          'already_linked',
          'This Steam account is already linked to another CampusGG user',
        );
      }

      throw error;
    }

    await this.redisService.tryDelete(this.statsKey(userId));
  }

  private async readCache(
    key: string,
  ): Promise<CachedSteamStats | null> {
    const raw = await this.redisService.tryGet(key);

    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw) as CachedSteamStats;

      if (
        parsed &&
        (parsed.status === 'OK' || parsed.status === 'PRIVATE_OR_EMPTY') &&
        Array.isArray(parsed.topGames) &&
        typeof parsed.fetchedAt === 'string'
      ) {
        return parsed;
      }
    } catch {
      // Fall through and invalidate the corrupt cache entry.
    }

    await this.redisService.tryDelete(key);
    return null;
  }

  private toResponse(
    user: User,
    steamId: string,
    cached: CachedSteamStats,
    fromCache: boolean,
    top: number,
  ): SteamStatsResponse {
    const response: SteamStatsResponse = {
      status: cached.status,
      steamId,
      profileUrl: this.profileUrl(steamId),
      linkedAt: user.steamLinkedAt?.toISOString() ?? null,
      fetchedAt: cached.fetchedAt,
      cached: fromCache,
      gameCount: cached.gameCount,
      topGames: cached.topGames.slice(0, top),
      cs2: cached.cs2,
      dota2: cached.dota2,
    };

    if (cached.status === 'PRIVATE_OR_EMPTY') {
      response.message =
        'Steam returned no games. Set Steam → Privacy Settings → Game details to Public, then re-sync.';
    }

    return response;
  }

  private clampTop(value: number): number {
    if (!Number.isInteger(value)) return 10;
    return Math.min(Math.max(value, 1), 50);
  }

  private profileUrl(steamId: string): string {
    return `https://steamcommunity.com/profiles/${steamId}`;
  }

  private statsKey(userId: string): string {
    return `steam:stats:${userId}`;
  }

  private profileRedirect(params: Record<string, string>): string {
    const url = new URL('/profile', this.frontendBaseUrl);

    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    return url.toString();
  }

  private normalizeBaseUrl(value: string): string {
    return value.replace(/\/+$/, '');
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: unknown }).code === '23505'
    );
  }
}

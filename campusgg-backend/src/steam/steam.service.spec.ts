import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Repository } from 'typeorm';

// @nestjs/jwt is ESM-only; the service under test never calls it directly.
jest.mock('@nestjs/jwt', () => ({ JwtService: class {} }));

import type { RedisService } from '../redis/redis.service';
import type { User } from '../users/user.entity';
import { SteamApiError } from './steam-api.error';
import type { SteamApiService } from './steam-api.service';
import { SteamLinkError } from './steam-link.error';
import type { SteamOpenIdService } from './steam-openid.service';
import { SteamService } from './steam.service';
import type {
  CachedSteamStats,
  SteamGameDto,
  SteamStatsQueryDto,
  SteamStatsSnapshot,
} from './dto/steam-stats.dto';

const USER_ID = 'user-1';
const STEAM_ID = '76561198000000000';
const OTHER_STEAM_ID = '76561198000000001';
const CACHE_KEY = `steam:stats:${USER_ID}`;
const FRONTEND_URL = 'http://localhost:5173';

function game(
  appId: number,
  playtimeForeverMinutes = appId * 60,
): SteamGameDto {
  return {
    appId,
    name: `Game ${appId}`,
    playtimeForeverMinutes,
    playtimeForeverHours: playtimeForeverMinutes / 60,
    playtime2WeeksMinutes: 0,
    playtime2WeeksHours: 0,
    iconUrl: null,
  };
}

function snapshot(
  overrides: Partial<SteamStatsSnapshot> = {},
): SteamStatsSnapshot {
  return {
    status: 'OK',
    gameCount: 2,
    topGames: [game(730, 7260), game(570, 120)],
    cs2: game(730, 7260),
    dota2: game(570, 120),
    ...overrides,
  };
}

function query(overrides: Partial<SteamStatsQueryDto> = {}) {
  return {
    top: 10,
    refresh: false,
    ...overrides,
  } as SteamStatsQueryDto;
}

describe('SteamService', () => {
  let usersRepository: {
    findOne: jest.Mock;
    update: jest.Mock;
  };
  let openIdService: {
    createLinkUrl: jest.Mock;
    verifyCallback: jest.Mock;
  };
  let steamApiService: { getOwnedGames: jest.Mock };
  let redisService: {
    tryGet: jest.Mock;
    trySet: jest.Mock;
    tryDelete: jest.Mock;
  };
  let service: SteamService;

  const linkedUser = (overrides: Record<string, unknown> = {}) => ({
    id: USER_ID,
    steamId: STEAM_ID,
    steamLinkedAt: new Date('2026-01-02T03:04:05.000Z'),
    ...overrides,
  });

  beforeEach(() => {
    jest.resetAllMocks();

    usersRepository = {
      findOne: jest.fn(),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    openIdService = {
      createLinkUrl: jest.fn(),
      verifyCallback: jest.fn(),
    };
    steamApiService = { getOwnedGames: jest.fn() };
    redisService = {
      tryGet: jest.fn().mockResolvedValue(null),
      trySet: jest.fn().mockResolvedValue(undefined),
      tryDelete: jest.fn().mockResolvedValue(undefined),
    };

    service = new SteamService(
      usersRepository as unknown as Repository<User>,
      openIdService as unknown as SteamOpenIdService,
      steamApiService as unknown as SteamApiService,
      redisService as unknown as RedisService,
      new ConfigService({ FRONTEND_BASE_URL: `${FRONTEND_URL}/` }),
    );
  });

  describe('createLinkUrl', () => {
    it('delegates to the OpenID service for the current user', async () => {
      openIdService.createLinkUrl.mockResolvedValue({
        url: 'https://steamcommunity.com/openid/login?x=1',
      });

      await expect(service.createLinkUrl(USER_ID)).resolves.toEqual({
        url: 'https://steamcommunity.com/openid/login?x=1',
      });
      expect(openIdService.createLinkUrl).toHaveBeenCalledWith(USER_ID);
    });
  });

  describe('handleCallback', () => {
    it('links the account and redirects to the profile on success', async () => {
      openIdService.verifyCallback.mockResolvedValue({
        userId: USER_ID,
        steamId: STEAM_ID,
      });
      usersRepository.findOne
        .mockResolvedValueOnce({ id: USER_ID, steamId: null })
        .mockResolvedValueOnce(null);

      await expect(service.handleCallback({})).resolves.toBe(
        `${FRONTEND_URL}/profile?steam=linked`,
      );

      expect(usersRepository.update).toHaveBeenCalledWith(
        USER_ID,
        expect.objectContaining({
          steamId: STEAM_ID,
          steamLinkedAt: expect.any(Date),
          steamSyncedAt: null,
          steamCs2PlaytimeMinutes: null,
          steamDota2PlaytimeMinutes: null,
        }),
      );
      expect(redisService.tryDelete).toHaveBeenCalledWith(CACHE_KEY);
    });

    it('does not rewrite an already-matching link', async () => {
      openIdService.verifyCallback.mockResolvedValue({
        userId: USER_ID,
        steamId: STEAM_ID,
      });
      usersRepository.findOne.mockResolvedValueOnce(linkedUser());

      await expect(service.handleCallback({})).resolves.toBe(
        `${FRONTEND_URL}/profile?steam=linked`,
      );

      expect(usersRepository.update).not.toHaveBeenCalled();
      expect(redisService.tryDelete).not.toHaveBeenCalled();
    });

    it('rejects a Steam account already linked to another user', async () => {
      openIdService.verifyCallback.mockResolvedValue({
        userId: USER_ID,
        steamId: STEAM_ID,
      });
      usersRepository.findOne
        .mockResolvedValueOnce({ id: USER_ID, steamId: null })
        .mockResolvedValueOnce({ id: 'user-2', steamId: STEAM_ID });

      await expect(service.handleCallback({})).resolves.toBe(
        `${FRONTEND_URL}/profile?steam=error&reason=already_linked`,
      );

      expect(usersRepository.update).not.toHaveBeenCalled();
    });

    it('maps a unique-index race to an already_linked redirect', async () => {
      openIdService.verifyCallback.mockResolvedValue({
        userId: USER_ID,
        steamId: STEAM_ID,
      });
      usersRepository.findOne
        .mockResolvedValueOnce({ id: USER_ID, steamId: null })
        .mockResolvedValueOnce(null);
      usersRepository.update.mockRejectedValue({ code: '23505' });

      await expect(service.handleCallback({})).resolves.toBe(
        `${FRONTEND_URL}/profile?steam=error&reason=already_linked`,
      );
    });

    it('redirects with the OpenID failure reason', async () => {
      openIdService.verifyCallback.mockRejectedValue(
        new SteamLinkError('invalid_state', 'bad state'),
      );

      await expect(service.handleCallback({})).resolves.toBe(
        `${FRONTEND_URL}/profile?steam=error&reason=invalid_state`,
      );
      expect(usersRepository.update).not.toHaveBeenCalled();
    });

    it('redirects with unexpected for unknown failures', async () => {
      openIdService.verifyCallback.mockRejectedValue(new Error('boom'));

      await expect(service.handleCallback({})).resolves.toBe(
        `${FRONTEND_URL}/profile?steam=error&reason=unexpected`,
      );
    });
  });

  describe('unlinkSteam', () => {
    it('clears Steam fields and cached stats', async () => {
      usersRepository.findOne.mockResolvedValue(linkedUser());

      await expect(service.unlinkSteam(USER_ID)).resolves.toEqual({
        status: 'NOT_LINKED',
      });

      expect(usersRepository.update).toHaveBeenCalledWith(USER_ID, {
        steamId: null,
        steamLinkedAt: null,
        steamSyncedAt: null,
        steamCs2PlaytimeMinutes: null,
        steamDota2PlaytimeMinutes: null,
      });
      expect(redisService.tryDelete).toHaveBeenCalledWith(CACHE_KEY);
    });

    it('does nothing when no Steam account is linked', async () => {
      usersRepository.findOne.mockResolvedValue({
        id: USER_ID,
        steamId: null,
      });

      await expect(service.unlinkSteam(USER_ID)).resolves.toEqual({
        status: 'NOT_LINKED',
      });

      expect(usersRepository.update).not.toHaveBeenCalled();
      expect(redisService.tryDelete).not.toHaveBeenCalled();
    });

    it('throws NotFoundException for an unknown user', async () => {
      usersRepository.findOne.mockResolvedValue(null);

      await expect(service.unlinkSteam(USER_ID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('getStats', () => {
    it('returns NOT_LINKED without touching Redis or Steam', async () => {
      usersRepository.findOne.mockResolvedValue({
        id: USER_ID,
        steamId: null,
      });

      await expect(service.getStats(USER_ID, query())).resolves.toEqual({
        status: 'NOT_LINKED',
      });

      expect(redisService.tryGet).not.toHaveBeenCalled();
      expect(steamApiService.getOwnedGames).not.toHaveBeenCalled();
    });

    it('throws NotFoundException for an unknown user', async () => {
      usersRepository.findOne.mockResolvedValue(null);

      await expect(service.getStats(USER_ID, query())).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('returns cached stats without calling Steam', async () => {
      usersRepository.findOne.mockResolvedValue(linkedUser());
      const cached: CachedSteamStats = {
        ...snapshot({
          topGames: [game(730, 7260), game(570, 120), game(440, 60)],
        }),
        fetchedAt: '2026-02-03T04:05:06.000Z',
      };
      redisService.tryGet.mockResolvedValue(JSON.stringify(cached));

      const result = await service.getStats(
        USER_ID,
        query({ top: 2 }),
      );

      expect(result).toMatchObject({
        status: 'OK',
        steamId: STEAM_ID,
        profileUrl: `https://steamcommunity.com/profiles/${STEAM_ID}`,
        linkedAt: '2026-01-02T03:04:05.000Z',
        fetchedAt: cached.fetchedAt,
        cached: true,
        gameCount: 2,
      });
      expect(result.topGames).toHaveLength(2);
      expect(result.cs2?.appId).toBe(730);
      expect(result.dota2?.appId).toBe(570);
      expect(steamApiService.getOwnedGames).not.toHaveBeenCalled();
      expect(redisService.trySet).not.toHaveBeenCalled();
    });

    it('bypasses the cache on refresh, persists playtime, and caches OK for 45 minutes', async () => {
      usersRepository.findOne.mockResolvedValue(linkedUser());
      steamApiService.getOwnedGames.mockResolvedValue(snapshot());

      const result = await service.getStats(
        USER_ID,
        query({ refresh: true }),
      );

      expect(redisService.tryGet).not.toHaveBeenCalled();
      expect(steamApiService.getOwnedGames).toHaveBeenCalledWith(STEAM_ID);
      expect(redisService.trySet).toHaveBeenCalledWith(
        CACHE_KEY,
        expect.any(String),
        2700,
      );

      const persisted = JSON.parse(
        redisService.trySet.mock.calls[0][1] as string,
      ) as CachedSteamStats;
      expect(persisted).toMatchObject({
        status: 'OK',
        gameCount: 2,
        cs2: expect.objectContaining({ appId: 730 }),
        dota2: expect.objectContaining({ appId: 570 }),
        fetchedAt: expect.any(String),
      });

      expect(usersRepository.update).toHaveBeenCalledWith(USER_ID, {
        steamSyncedAt: expect.any(Date),
        steamCs2PlaytimeMinutes: 7260,
        steamDota2PlaytimeMinutes: 120,
      });
      expect(result.cached).toBe(false);
      expect(result.status).toBe('OK');
    });

    it('caches PRIVATE_OR_EMPTY for 5 minutes and returns a privacy hint', async () => {
      usersRepository.findOne.mockResolvedValue(linkedUser());
      steamApiService.getOwnedGames.mockResolvedValue(
        snapshot({
          status: 'PRIVATE_OR_EMPTY',
          gameCount: null,
          topGames: [],
          cs2: null,
          dota2: null,
        }),
      );

      const result = await service.getStats(USER_ID, query());

      expect(redisService.trySet).toHaveBeenCalledWith(
        CACHE_KEY,
        expect.any(String),
        300,
      );
      expect(result.status).toBe('PRIVATE_OR_EMPTY');
      expect(result.message).toContain('Privacy Settings');
      expect(usersRepository.update).not.toHaveBeenCalled();
    });

    it('invalidates a corrupt cache entry before refetching', async () => {
      usersRepository.findOne.mockResolvedValue(linkedUser());
      redisService.tryGet.mockResolvedValue('not-json');
      steamApiService.getOwnedGames.mockResolvedValue(snapshot());

      await service.getStats(USER_ID, query());

      expect(redisService.tryDelete).toHaveBeenCalledWith(CACHE_KEY);
      expect(steamApiService.getOwnedGames).toHaveBeenCalledWith(STEAM_ID);
    });

    it('returns UNAVAILABLE instead of throwing when Steam fails', async () => {
      usersRepository.findOne.mockResolvedValue(linkedUser());
      steamApiService.getOwnedGames.mockRejectedValue(
        new SteamApiError('Steam is temporarily unavailable'),
      );

      const result = await service.getStats(USER_ID, query());

      expect(result).toMatchObject({
        status: 'UNAVAILABLE',
        steamId: STEAM_ID,
        profileUrl: `https://steamcommunity.com/profiles/${STEAM_ID}`,
        linkedAt: '2026-01-02T03:04:05.000Z',
        cached: false,
        message: expect.stringContaining('temporarily unavailable'),
      });
      expect(redisService.trySet).not.toHaveBeenCalled();
      expect(usersRepository.update).not.toHaveBeenCalled();
    });

    it('clamps the requested top game count', async () => {
      usersRepository.findOne.mockResolvedValue(linkedUser());
      const cached: CachedSteamStats = {
        ...snapshot({
          topGames: [game(730), game(570), game(440)],
        }),
        fetchedAt: '2026-02-03T04:05:06.000Z',
      };
      redisService.tryGet.mockResolvedValue(JSON.stringify(cached));

      const result = await service.getStats(USER_ID, query({ top: 0 }));

      expect(result.topGames).toHaveLength(1);
    });
  });
});

import { HttpStatus, UnauthorizedException } from '@nestjs/common';

// @nestjs/jwt is ESM-only and the guard is not exercised in this unit test.
jest.mock('@nestjs/jwt', () => ({ JwtService: class {} }));

import type { AuthenticatedRequest } from '../auth/jwt-auth.guard';
import { SteamController } from './steam.controller';
import type { SteamService } from './steam.service';
import type { SteamStatsQueryDto } from './dto/steam-stats.dto';

const USER_ID = 'user-1';

function authenticatedRequest(): AuthenticatedRequest {
  return { user: { id: USER_ID } } as AuthenticatedRequest;
}

function anonymousRequest(): AuthenticatedRequest {
  return {} as AuthenticatedRequest;
}

describe('SteamController', () => {
  let steamService: {
    createLinkUrl: jest.Mock;
    handleCallback: jest.Mock;
    unlinkSteam: jest.Mock;
    getStats: jest.Mock;
  };
  let controller: SteamController;

  beforeEach(() => {
    jest.resetAllMocks();

    steamService = {
      createLinkUrl: jest.fn(),
      handleCallback: jest.fn(),
      unlinkSteam: jest.fn(),
      getStats: jest.fn(),
    };
    controller = new SteamController(
      steamService as unknown as SteamService,
    );
  });

  it('requests a link URL for the authenticated user', async () => {
    steamService.createLinkUrl.mockResolvedValue({
      url: 'https://steamcommunity.com/openid/login',
    });

    await expect(
      controller.createLink(authenticatedRequest()),
    ).resolves.toEqual({
      url: 'https://steamcommunity.com/openid/login',
    });
    expect(steamService.createLinkUrl).toHaveBeenCalledWith(USER_ID);
  });

  it('requires authentication to start linking', () => {
    expect(() => controller.createLink(anonymousRequest())).toThrow(
      UnauthorizedException,
    );
    expect(steamService.createLinkUrl).not.toHaveBeenCalled();
  });

  it('redirects the callback result to the frontend', async () => {
    steamService.handleCallback.mockResolvedValue(
      'http://localhost:5173/profile?steam=linked',
    );

    await expect(
      controller.callback({ state: 'state-token' }),
    ).resolves.toEqual({
      url: 'http://localhost:5173/profile?steam=linked',
      statusCode: HttpStatus.FOUND,
    });
    expect(steamService.handleCallback).toHaveBeenCalledWith({
      state: 'state-token',
    });
  });

  it('unlinks the authenticated user account', async () => {
    steamService.unlinkSteam.mockResolvedValue({ status: 'NOT_LINKED' });

    await expect(
      controller.unlink(authenticatedRequest()),
    ).resolves.toEqual({ status: 'NOT_LINKED' });
    expect(steamService.unlinkSteam).toHaveBeenCalledWith(USER_ID);
  });

  it('passes stats query options through for the authenticated user', async () => {
    const query = { top: 5, refresh: true } as SteamStatsQueryDto;
    const stats = { status: 'OK' };
    steamService.getStats.mockResolvedValue(stats);

    await expect(
      controller.stats(authenticatedRequest(), query),
    ).resolves.toBe(stats);
    expect(steamService.getStats).toHaveBeenCalledWith(USER_ID, query);
  });

  it('requires authentication for stats', () => {
    expect(() =>
      controller.stats(
        anonymousRequest(),
        { top: 5 } as SteamStatsQueryDto,
      ),
    ).toThrow(UnauthorizedException);
    expect(steamService.getStats).not.toHaveBeenCalled();
  });
});

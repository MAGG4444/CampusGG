import { ConfigService } from '@nestjs/config';

import { SteamApiError } from './steam-api.error';
import { SteamApiService } from './steam-api.service';

const STEAM_ID = '76561198000000000';

function createConfig(apiKey = 'test-key'): ConfigService {
  return new ConfigService({ STEAM_API_KEY: apiKey });
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('SteamApiService', () => {
  let fetchMock: jest.SpyInstance;

  beforeEach(() => {
    fetchMock = jest.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchMock.mockRestore();
  });

  it('fails fast when the API key is missing', async () => {
    const service = new SteamApiService(createConfig(''));

    await expect(service.getOwnedGames(STEAM_ID)).rejects.toBeInstanceOf(
      SteamApiError,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns PRIVATE_OR_EMPTY when Steam omits the games array', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ response: {} }));
    const service = new SteamApiService(createConfig());

    await expect(service.getOwnedGames(STEAM_ID)).resolves.toEqual({
      status: 'PRIVATE_OR_EMPTY',
      gameCount: null,
      topGames: [],
      cs2: null,
      dota2: null,
    });
  });

  it('treats an empty games array as PRIVATE_OR_EMPTY', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ response: { game_count: 0, games: [] } }),
    );
    const service = new SteamApiService(createConfig());

    await expect(service.getOwnedGames(STEAM_ID)).resolves.toMatchObject({
      status: 'PRIVATE_OR_EMPTY',
      gameCount: 0,
    });
  });

  it('sorts games, extracts CS2 and Dota 2, and builds icon URLs', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        response: {
          game_count: 5,
          games: [
            {
              appid: 730,
              name: 'Counter-Strike 2',
              playtime_forever: 7260,
              playtime_2weeks: 120,
              img_icon_url: 'cs2icon',
            },
            {
              appid: 570,
              name: 'Dota 2',
              playtime_forever: 120,
              img_icon_url: '',
            },
            {
              appid: 440,
              name: 'Team Fortress 2',
              playtime_forever: 600,
              playtime_2weeks: 0,
              img_icon_url: 'tf2icon',
            },
            {
              appid: 999,
              playtime_forever: 60,
            },
            {
              appid: 123,
              name: 'Never Played',
              playtime_forever: 0,
            },
          ],
        },
      }),
    );

    const service = new SteamApiService(createConfig());
    const result = await service.getOwnedGames(STEAM_ID);

    expect(result.status).toBe('OK');
    expect(result.gameCount).toBe(5);
    expect(result.topGames.map((game) => game.appId)).toEqual([
      730, 440, 570, 999,
    ]);
    expect(result.topGames[0]).toMatchObject({
      appId: 730,
      name: 'Counter-Strike 2',
      playtimeForeverMinutes: 7260,
      playtimeForeverHours: 121,
      playtime2WeeksMinutes: 120,
      playtime2WeeksHours: 2,
      iconUrl:
        'https://media.steampowered.com/steamcommunity/public/images/apps/730/cs2icon.jpg',
    });
    expect(result.topGames[2]).toMatchObject({
      appId: 570,
      playtimeForeverHours: 2,
      iconUrl: null,
    });
    expect(result.topGames[3]).toMatchObject({
      appId: 999,
      name: 'App 999',
    });
    expect(result.cs2?.appId).toBe(730);
    expect(result.dota2?.appId).toBe(570);

    const [requestUrl, options] = fetchMock.mock.calls[0] as [
      URL,
      RequestInit,
    ];
    const parsed = new URL(requestUrl.toString());
    expect(parsed.pathname).toBe(
      '/IPlayerService/GetOwnedGames/v1/',
    );
    expect(parsed.searchParams.get('key')).toBe('test-key');
    expect(parsed.searchParams.get('steamid')).toBe(STEAM_ID);
    expect(parsed.searchParams.get('include_appinfo')).toBe('1');
    expect(parsed.searchParams.get('include_played_free_games')).toBe(
      '1',
    );
    expect(options.signal).toBeInstanceOf(AbortSignal);
  });

  it('maps non-2xx Steam responses to SteamApiError', async () => {
    fetchMock.mockResolvedValue(
      new Response('Forbidden', { status: 403 }),
    );
    const service = new SteamApiService(createConfig());

    await expect(service.getOwnedGames(STEAM_ID)).rejects.toThrow(
      'Steam returned HTTP 403',
    );
  });

  it('maps network failures to SteamApiError', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    const service = new SteamApiService(createConfig());

    await expect(service.getOwnedGames(STEAM_ID)).rejects.toBeInstanceOf(
      SteamApiError,
    );
  });
});

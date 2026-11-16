import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type {
  SteamGameDto,
  SteamStatsSnapshot,
} from './dto/steam-stats.dto';
import { SteamApiError } from './steam-api.error';

const STEAM_OWNED_GAMES_ENDPOINT =
  'https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/';
const TOP_GAMES_CACHE_LIMIT = 50;
const CS2_APP_ID = 730;
const DOTA2_APP_ID = 570;

interface SteamOwnedGamesResponse {
  response?: {
    game_count?: unknown;
    games?: unknown;
  };
}

interface RawSteamGame {
  appid: number;
  name?: unknown;
  playtime_2weeks?: unknown;
  playtime_forever?: unknown;
  img_icon_url?: unknown;
}

@Injectable()
export class SteamApiService {
  constructor(private readonly config: ConfigService) {}

  async getOwnedGames(steamId: string): Promise<SteamStatsSnapshot> {
    const apiKey = this.config.get<string>('STEAM_API_KEY')?.trim();

    if (!apiKey) {
      throw new SteamApiError('Steam integration is not configured');
    }

    const url = new URL(STEAM_OWNED_GAMES_ENDPOINT);
    url.search = new URLSearchParams({
      key: apiKey,
      steamid: steamId,
      include_appinfo: '1',
      include_played_free_games: '1',
      format: 'json',
    }).toString();

    let response: Response;

    try {
      response = await fetch(url, {
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw new SteamApiError('Steam is temporarily unavailable');
    }

    if (!response.ok) {
      throw new SteamApiError(
        `Steam returned HTTP ${response.status}`,
      );
    }

    let data: SteamOwnedGamesResponse;

    try {
      data = (await response.json()) as SteamOwnedGamesResponse;
    } catch {
      throw new SteamApiError('Steam returned an invalid response');
    }

    const steamResponse = data?.response;

    if (
      !steamResponse ||
      !Array.isArray(steamResponse.games) ||
      steamResponse.games.length === 0
    ) {
      return {
        status: 'PRIVATE_OR_EMPTY',
        gameCount: this.toGameCount(steamResponse?.game_count),
        topGames: [],
        cs2: null,
        dota2: null,
      };
    }

    const games = steamResponse.games
      .filter((game): game is RawSteamGame => this.isRawSteamGame(game))
      .map((game) => this.toSteamGame(game));

    if (games.length === 0) {
      return {
        status: 'PRIVATE_OR_EMPTY',
        gameCount: this.toGameCount(steamResponse.game_count),
        topGames: [],
        cs2: null,
        dota2: null,
      };
    }

    const played = games
      .filter((game) => game.playtimeForeverMinutes > 0)
      .sort(
        (a, b) =>
          b.playtimeForeverMinutes - a.playtimeForeverMinutes ||
          a.name.localeCompare(b.name),
      );

    return {
      status: 'OK',
      gameCount:
        this.toGameCount(steamResponse.game_count) ?? games.length,
      topGames: played.slice(0, TOP_GAMES_CACHE_LIMIT),
      cs2: games.find((game) => game.appId === CS2_APP_ID) ?? null,
      dota2: games.find((game) => game.appId === DOTA2_APP_ID) ?? null,
    };
  }

  private isRawSteamGame(value: unknown): value is RawSteamGame {
    if (typeof value !== 'object' || value === null) return false;

    const game = value as Record<string, unknown>;

    return (
      typeof game.appid === 'number' &&
      Number.isInteger(game.appid) &&
      game.appid > 0
    );
  }

  private toSteamGame(game: RawSteamGame): SteamGameDto {
    const playtimeForeverMinutes = this.toNonNegativeMinutes(
      game.playtime_forever,
    );
    const playtime2WeeksMinutes = this.toNonNegativeMinutes(
      game.playtime_2weeks,
    );
    const iconHash =
      typeof game.img_icon_url === 'string'
        ? game.img_icon_url.trim()
        : '';
    const name =
      typeof game.name === 'string' && game.name.trim()
        ? game.name.trim()
        : `App ${game.appid}`;

    return {
      appId: game.appid,
      name,
      playtimeForeverMinutes,
      playtimeForeverHours: this.minutesToHours(playtimeForeverMinutes),
      playtime2WeeksMinutes,
      playtime2WeeksHours: this.minutesToHours(playtime2WeeksMinutes),
      iconUrl: iconHash
        ? `https://media.steampowered.com/steamcommunity/public/images/apps/${game.appid}/${iconHash}.jpg`
        : null,
    };
  }

  private toNonNegativeMinutes(value: unknown): number {
    return typeof value === 'number' &&
      Number.isFinite(value) &&
      value > 0
      ? Math.floor(value)
      : 0;
  }

  private minutesToHours(minutes: number): number {
    return Math.round((minutes / 60) * 10) / 10;
  }

  private toGameCount(value: unknown): number | null {
    return typeof value === 'number' &&
      Number.isInteger(value) &&
      value >= 0
      ? value
      : null;
  }
}

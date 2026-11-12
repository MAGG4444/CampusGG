import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

export class SteamStatsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  top = 10;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  refresh = false;
}

export type SteamStatsStatus =
  | 'NOT_LINKED'
  | 'OK'
  | 'PRIVATE_OR_EMPTY'
  | 'UNAVAILABLE';

export interface SteamGameDto {
  appId: number;
  name: string;
  playtimeForeverMinutes: number;
  playtimeForeverHours: number;
  playtime2WeeksMinutes: number;
  playtime2WeeksHours: number;
  iconUrl: string | null;
}

export interface SteamStatsSnapshot {
  status: 'OK' | 'PRIVATE_OR_EMPTY';
  gameCount: number | null;
  topGames: SteamGameDto[];
  cs2: SteamGameDto | null;
  dota2: SteamGameDto | null;
}

export interface CachedSteamStats extends SteamStatsSnapshot {
  fetchedAt: string;
}

export interface SteamStatsResponse {
  status: SteamStatsStatus;
  steamId?: string;
  profileUrl?: string;
  linkedAt?: string | null;
  fetchedAt?: string;
  cached?: boolean;
  gameCount?: number | null;
  topGames?: SteamGameDto[];
  cs2?: SteamGameDto | null;
  dota2?: SteamGameDto | null;
  message?: string;
}

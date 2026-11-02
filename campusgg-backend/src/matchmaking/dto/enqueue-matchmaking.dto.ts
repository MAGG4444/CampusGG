/**
 * @file enqueue-matchmaking.dto.ts
 * @description Runtime validation for POST /matchmaking/enqueue.
 *
 * The DTO deliberately does NOT accept `userId` or `queueTime`:
 *   - userId is derived from the authenticated JWT.
 *   - queueTime is recorded server-side when the player is enqueued.
 */

import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDefined,
  IsIn,
  IsNumber,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

import {
  ACTIVE_SCHEDULES,
  SUPPORTED_GAMES,
  UNIVERSITY_DOMAINS,
} from '../schemas/player-matchmaking.schema.js';
import type {
  ActiveSchedule,
  SupportedGame,
  UniversityDomain,
} from '../schemas/player-matchmaking.schema.js';

export class PlayerProfileDto {
  @IsIn([...UNIVERSITY_DOMAINS])
  universityDomain!: UniversityDomain;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  major!: string;

  @IsIn([...ACTIVE_SCHEDULES])
  activeSchedule!: ActiveSchedule;
}

export class GameStatsDto {
  @IsIn([...SUPPORTED_GAMES])
  game!: SupportedGame;

  @IsNumber()
  @Min(0)
  @Max(35000)
  rating!: number;
}

export class PlayerPreferencesDto {
  @IsString()
  @MaxLength(50)
  primaryRole!: string;

  @IsString()
  @MaxLength(50)
  secondaryRole!: string;

  @IsBoolean()
  micEnabled!: boolean;
}

export class EnqueueMatchmakingDto {
  @IsIn([...SUPPORTED_GAMES])
  game!: SupportedGame;

  @IsDefined()
  @ValidateNested()
  @Type(() => PlayerProfileDto)
  profile!: PlayerProfileDto;

  @IsDefined()
  @ValidateNested()
  @Type(() => GameStatsDto)
  stats!: GameStatsDto;

  @IsDefined()
  @ValidateNested()
  @Type(() => PlayerPreferencesDto)
  preferences!: PlayerPreferencesDto;

  @IsNumber()
  @Min(0)
  @Max(1)
  intensity!: number;
}

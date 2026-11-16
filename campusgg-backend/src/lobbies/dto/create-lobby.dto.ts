import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

import { LobbyVisibility } from '../lobby.entity';

export class CreateLobbyDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  lobbyName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  subtitle?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  details!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(50)
  game?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  skillLevel?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ArrayUnique((role: unknown) =>
    typeof role === 'string' ? role.toLowerCase() : role,
  )
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  neededRoles?: string[];

  @IsOptional()
  @IsInt()
  @Min(1)
  participantLimit?: number;

  @IsOptional()
  @IsEnum(LobbyVisibility)
  visibility?: LobbyVisibility;
}

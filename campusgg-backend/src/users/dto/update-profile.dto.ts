import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsString,
  Length,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

const trimArray = ({ value }: { value: unknown }): unknown =>
  Array.isArray(value)
    ? value.map((item: unknown) =>
        typeof item === 'string' ? item.trim() : item,
      )
    : value;

export class GamingProfileDto {
  @Transform(trim)
  @IsString()
  @Length(1, 50)
  game!: string;

  @Transform(trimArray)
  @IsArray()
  @ArrayMaxSize(10)
  @ArrayUnique((role: unknown) =>
    typeof role === 'string' ? role.toLowerCase() : role,
  )
  @IsString({ each: true })
  @Length(1, 40, { each: true })
  preferredRoles!: string[];

  @Transform(trim)
  @IsString()
  @IsIn(['Beginner', 'Intermediate', 'Advanced'])
  experienceLevel!: string;
}

export class UpdateProfileDto {
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @Transform(trim)
  @IsString()
  @Length(1, 100)
  displayName?: string;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @MaxLength(500)
  bio?: string;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsArray()
  @ArrayMaxSize(10)
  @ArrayUnique((profile: unknown) =>
    typeof profile === 'object' && profile !== null && 'game' in profile
      ? String(profile.game).trim().toLowerCase()
      : profile,
  )
  @ValidateNested({ each: true })
  @Type(() => GamingProfileDto)
  gamingProfiles?: GamingProfileDto[];
}

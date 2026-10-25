import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsString,
  Length,
  MaxLength,
  ValidateIf,
} from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

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
  @Transform(({ value }: { value: unknown }) =>
    Array.isArray(value)
      ? value.map((game: unknown) =>
          typeof game === 'string' ? game.trim() : game,
        )
      : value,
  )
  @IsArray()
  @ArrayMaxSize(10)
  @ArrayUnique((game: unknown) =>
    typeof game === 'string' ? game.toLowerCase() : game,
  )
  @IsString({ each: true })
  @Length(1, 50, { each: true })
  favoriteGames?: string[];

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @IsIn(['', 'Beginner', 'Intermediate', 'Advanced'])
  skillLevel?: string;
}

import {
  IsString,
  IsOptional,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';

export class UpdateForumPostDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  @Matches(/\S/)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(10000)
  @Matches(/\S/)
  content?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  game?: string;
}

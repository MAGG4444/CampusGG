import { IsOptional, IsString, MaxLength } from 'class-validator';

export class SearchLobbiesDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  game?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  skillLevel?: string;
}

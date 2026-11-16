import { IsOptional, IsString, MaxLength } from 'class-validator';

export class QuickJoinDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  game?: string;
}

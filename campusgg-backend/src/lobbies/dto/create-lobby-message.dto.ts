import { IsString, Matches, MaxLength } from 'class-validator';

export class CreateLobbyMessageDto {
  @IsString()
  @Matches(/\S/, { message: 'Message must not be empty' })
  @MaxLength(2000)
  content!: string;
}

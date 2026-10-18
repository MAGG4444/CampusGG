import { IsString, MaxLength, MinLength, Matches } from 'class-validator';

export class CreateForumCommentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  @Matches(/\S/, {
    message: 'Comment cannot be empty',
  })
  content!: string;
}

import { IsString, MinLength, MaxLength, Matches } from 'class-validator';

export class UpdateForumCommentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  @Matches(/\S/, {
    message: 'Comment cannot be empty',
  })
  content!: string;
}

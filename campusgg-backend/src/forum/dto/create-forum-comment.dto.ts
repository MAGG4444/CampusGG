import {
  IsString,
  MaxLength,
  MinLength,
  Matches,
  IsOptional,
  IsUUID,
} from 'class-validator';

export class CreateForumCommentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  @Matches(/\S/, {
    message: 'Comment cannot be empty',
  })
  content!: string;

  @IsOptional()
  @IsUUID()
  parentReplyId?: string;
}

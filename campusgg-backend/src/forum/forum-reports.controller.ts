import {
  Body,
  Controller,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { IsNull, Repository } from 'typeorm';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard';
import { ForumPost } from './forum-post.entity';
import { ForumComment } from './forum-comment.entity';
import { ForumReport } from './forum-report.entity';

class ReportDto {
  @IsIn(['spam', 'harassment', 'hate', 'inappropriate', 'other'])
  reason!: string;
  @ValidateIf((value: ReportDto) => value.reason === 'other')
  @IsString()
  @Matches(/\S/)
  @MaxLength(1000)
  customReason?: string;
  @IsOptional() @IsString() @MaxLength(2000) details?: string;
}

@Controller('forum/posts/:postId')
@UseGuards(JwtAuthGuard)
export class ForumReportsController {
  constructor(
    @InjectRepository(ForumReport)
    private readonly reports: Repository<ForumReport>,
    @InjectRepository(ForumPost) private readonly posts: Repository<ForumPost>,
    @InjectRepository(ForumComment)
    private readonly comments: Repository<ForumComment>,
  ) {}

  @Post('report')
  reportPost(
    @Param('postId', ParseUUIDPipe) postId: string,
    @Body() dto: ReportDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.save(postId, null, dto, request);
  }

  @Post('comments/:commentId/report')
  reportComment(
    @Param('postId', ParseUUIDPipe) postId: string,
    @Param('commentId', ParseUUIDPipe) commentId: string,
    @Body() dto: ReportDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.save(postId, commentId, dto, request);
  }

  private async save(
    postId: string,
    commentId: string | null,
    dto: ReportDto,
    request: AuthenticatedRequest,
  ) {
    if (!request.user?.id) throw new UnauthorizedException();
    if (!(await this.posts.findOneBy({ id: postId })))
      throw new NotFoundException('Post not found');
    if (
      commentId &&
      !(await this.comments.findOne({
        where: { id: commentId, post: { id: postId }, deletedAt: IsNull() },
      }))
    )
      throw new NotFoundException('Comment not found');
    await this.reports.save(
      this.reports.create({
        post: { id: postId },
        comment: commentId ? { id: commentId } : null,
        reporter: { id: request.user.id },
        reason: dto.reason,
        customReason: dto.reason === 'other' ? dto.customReason!.trim() : null,
        details: dto.details?.trim() || null,
      }),
    );
    return { submitted: true };
  }
}

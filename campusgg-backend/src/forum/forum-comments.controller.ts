import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard';

import { ForumCommentsService } from './forum-comments.service';
import { CreateForumCommentDto } from './dto/create-forum-comment.dto';
import { Patch, Delete } from '@nestjs/common';
import { UpdateForumCommentDto } from './dto/update-forum-comment.dto';

@Controller('forum/posts/:postId/comments')
export class ForumCommentsController {
  constructor(private readonly commentsService: ForumCommentsService) {}

  @Get()
  findAll(
    @Param('postId', ParseUUIDPipe) postId: string,

    @Query('page', new DefaultValuePipe(1), ParseIntPipe)
    page: number,

    @Query('limit', new DefaultValuePipe(20), ParseIntPipe)
    limit: number,
  ) {
    return this.commentsService.findAll(postId, page, limit);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(
    @Param('postId', ParseUUIDPipe) postId: string,
    @Body() dto: CreateForumCommentDto,
    @Req() request: AuthenticatedRequest,
  ) {
    const userId = request.user?.id;

    if (!userId) {
      throw new UnauthorizedException();
    }

    return this.commentsService.create(postId, dto, userId);
  }

  @Get('likes/me')
  @UseGuards(JwtAuthGuard)
  likedIds(
    @Param('postId', ParseUUIDPipe) postId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    if (!request.user?.id) throw new UnauthorizedException();
    return this.commentsService.likedIds(postId, request.user.id);
  }

  @Post(':commentId/like')
  @UseGuards(JwtAuthGuard)
  like(
    @Param('postId', ParseUUIDPipe) postId: string,
    @Param('commentId', ParseUUIDPipe) commentId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    if (!request.user?.id) throw new UnauthorizedException();
    return this.commentsService.setLike(
      postId,
      commentId,
      request.user.id,
      true,
    );
  }

  @Delete(':commentId/like')
  @UseGuards(JwtAuthGuard)
  unlike(
    @Param('postId', ParseUUIDPipe) postId: string,
    @Param('commentId', ParseUUIDPipe) commentId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    if (!request.user?.id) throw new UnauthorizedException();
    return this.commentsService.setLike(
      postId,
      commentId,
      request.user.id,
      false,
    );
  }

  @Patch(':commentId')
  @UseGuards(JwtAuthGuard)
  update(
    @Param('postId', ParseUUIDPipe) postId: string,
    @Param('commentId', ParseUUIDPipe) commentId: string,
    @Body() dto: UpdateForumCommentDto,
    @Req() request: AuthenticatedRequest,
  ) {
    const userId = request.user?.id;

    if (!userId) {
      throw new UnauthorizedException();
    }

    return this.commentsService.update(postId, commentId, dto, userId);
  }

  @Delete(':commentId')
  @UseGuards(JwtAuthGuard)
  remove(
    @Param('postId', ParseUUIDPipe) postId: string,
    @Param('commentId', ParseUUIDPipe) commentId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    const userId = request.user?.id;

    if (!userId) {
      throw new UnauthorizedException();
    }

    return this.commentsService.remove(postId, commentId, userId);
  }
}

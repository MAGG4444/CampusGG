
import {
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard';
import { ForumPost } from './forum-post.entity';
import { ForumPostLike } from './forum-post-like.entity';

@Controller('forum/posts/:postId/likes')
export class ForumLikeStatusController {
  constructor(
    @InjectRepository(ForumPost)
    private readonly posts: Repository<ForumPost>,

    @InjectRepository(ForumPostLike)
    private readonly likes: Repository<ForumPostLike>,
  ) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMine(
    @Param('postId', ParseUUIDPipe) postId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    const userId = request.user?.id;

    if (!userId) {
      throw new UnauthorizedException();
    }

    const postExists = await this.posts.existsBy({
      id: postId,
    });

    if (!postExists) {
      throw new NotFoundException('Forum post not found');
    }

    const liked = await this.likes.exists({
      where: {
        post: { id: postId },
        user: { id: userId },
      },
    });

    return {
      postId,
      liked,
    };
  }
}


import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';
import { User } from '../users/user.entity';

import { ForumPost } from './forum-post.entity';
import { ForumComment } from './forum-comment.entity';
import { ForumPostLike } from './forum-post-like.entity';

import { ForumController } from './forum.controller';
import { ForumService } from './forum.service';

import { ForumCommentsController } from './forum-comments.controller';
import { ForumCommentsService } from './forum-comments.service';

import { ForumLikeStatusController } from './forum-like-status.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ForumPost,
      ForumComment,
      ForumPostLike,
      User,
    ]),
    AuthModule,
  ],
  controllers: [
    ForumController,
    ForumCommentsController,
    ForumLikeStatusController,
  ],
  providers: [
    ForumService,
    ForumCommentsService,
  ],
})
export class ForumModule {}

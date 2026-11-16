import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';
import { User } from '../users/user.entity';

import { ForumRankingService } from './forum-ranking.service';
import { ForumRankingController } from './forum-ranking.controller';
import { ForumChannelFollow } from './forum-channel-follow.entity';
import { ForumFollowsController } from './forum-follows.controller';
import { ForumFollowsService } from './forum-follows.service';
import { ForumChannel } from './forum-channel.entity';
import { ForumChannelsController } from './forum-channels.controller';
import { ForumChannelsService } from './forum-channels.service';

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
      ForumChannel,
      ForumChannelFollow,
      ForumPost,
      ForumComment,
      ForumPostLike,
      User,
    ]),
    AuthModule,
  ],
  controllers: [
    ForumController,
    ForumChannelsController,
    ForumFollowsController,
    ForumRankingController,
    ForumCommentsController,
    ForumLikeStatusController,
  ],
  providers: [
    ForumService,
    ForumCommentsService,
    ForumChannelsService,
    ForumFollowsService,
    ForumRankingService,
  ],
})
export class ForumModule {}

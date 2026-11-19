import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ForumPost } from './forum-post.entity';
import { ForumPostFollow } from './forum-post-follow.entity';

@Injectable()
export class ForumPostFollowsService {
  constructor(
    @InjectRepository(ForumPostFollow)
    private readonly follows: Repository<ForumPostFollow>,
    @InjectRepository(ForumPost) private readonly posts: Repository<ForumPost>,
  ) {}

  async set(userId: string, postId: string, following: boolean) {
    if (!(await this.posts.existsBy({ id: postId })))
      throw new NotFoundException('Forum post not found');
    if (following)
      await this.follows
        .createQueryBuilder()
        .insert()
        .into(ForumPostFollow)
        .values({ userId, postId })
        .orIgnore()
        .execute();
    else await this.follows.delete({ userId, postId });
    return { following: await this.follows.existsBy({ userId, postId }) };
  }

  async status(userId: string, ids: string[]) {
    if (!ids.length) return { followedIds: [] };
    const rows = await this.follows.find({
      where: { userId, postId: In(ids) },
    });
    return { followedIds: rows.map((row) => row.postId) };
  }
}

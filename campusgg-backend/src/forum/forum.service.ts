import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { User } from '../users/user.entity';
import { ForumPost } from './forum-post.entity';
import { ForumPostLike } from './forum-post-like.entity';
import { CreateForumPostDto } from './dto/create-forum-post.dto';
import { UpdateForumPostDto } from './dto/update-forum-post.dto';

@Injectable()
export class ForumService {
  constructor(
    @InjectRepository(ForumPost)
    private readonly posts: Repository<ForumPost>,

    @InjectRepository(User)
    private readonly users: Repository<User>,

    @InjectRepository(ForumPostLike)
    private readonly likes: Repository<ForumPostLike>,
  ) {}

  private baseQuery() {
    return this.posts
      .createQueryBuilder('post')
      .innerJoin('post.author', 'author')
      .select([
        'post.id',
        'post.title',
        'post.content',
        'post.game',
        'post.createdAt',
        'post.updatedAt',
        'author.id',
        'author.username',
        'author.displayName',
      ]);
  }

  private async attachLikeCounts(posts: ForumPost[]): Promise<void> {
    if (posts.length === 0) return;

    const postIds = posts.map((post) => post.id);

    const results = await this.likes
      .createQueryBuilder('like')
      .innerJoin('like.post', 'post')
      .select('post.id', 'postId')
      .addSelect('COUNT(like.id)', 'likeCount')
      .where('post.id IN (:...postIds)', { postIds })
      .groupBy('post.id')
      .getRawMany<{
        postId: string;
        likeCount: string;
      }>();

    const counts = new Map(
      results.map((row) => [row.postId, Number(row.likeCount)]),
    );

    for (const post of posts) {
      post.likeCount = counts.get(post.id) ?? 0;
    }
  }

  async create(dto: CreateForumPostDto, userId: string) {
    const author = await this.users.findOneBy({
      id: userId,
      eduVerified: true,
    });

    if (!author) {
      throw new ForbiddenException('A verified account is required');
    }

    const post = this.posts.create({
      title: dto.title.trim(),
      content: dto.content.trim(),
      game: dto.game?.trim() || null,
      author,
    });

    const saved = await this.posts.save(post);

    return this.findOne(saved.id);
  }

  async findAll(page = 1, limit = 25) {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(100, Math.max(1, limit));

    const [posts, total] = await this.baseQuery()
      .orderBy('post.createdAt', 'DESC')
      .skip((safePage - 1) * safeLimit)
      .take(safeLimit)
      .getManyAndCount();

    // Attach like counts to the retrieved posts
    await this.attachLikeCounts(posts);

    return {
      posts,
      total,
      page: safePage,
      limit: safeLimit,
    };
  }

  async findOne(id: string) {
    const post = await this.baseQuery().where('post.id = :id', { id }).getOne();

    if (!post) {
      throw new NotFoundException('Forum post not found');
    }

    await this.attachLikeCounts([post]);

    return post;
  }

  async update(id: string, dto: UpdateForumPostDto, userId: string) {
    const post = await this.posts.findOne({
      where: { id },
      relations: { author: true },
    });

    if (!post) {
      throw new NotFoundException('Forum post not found');
    }

    // Only the author can edit their own post
    if (post.author.id !== userId) {
      throw new ForbiddenException("You cannot edit another user's post");
    }

    if (dto.title !== undefined) {
      post.title = dto.title.trim();
    }

    if (dto.content !== undefined) {
      post.content = dto.content.trim();
    }

    if (dto.game !== undefined) {
      post.game = dto.game.trim() || null;
    }

    await this.posts.save(post);

    return this.findOne(id);
  }

  async remove(id: string, userId: string) {
    const post = await this.posts.findOne({
      where: { id },
      relations: { author: true },
    });

    if (!post) {
      throw new NotFoundException('Forum post not found');
    }

    // Only the author can delete their own post
    if (post.author.id !== userId) {
      throw new ForbiddenException("You cannot delete another user's post");
    }

    await this.posts.remove(post);

    return {
      message: 'Forum post deleted successfully',
    };
  }

  async likePost(postId: string, userId: string) {
    const post = await this.posts.findOneBy({
      id: postId,
    });

    if (!post) {
      throw new NotFoundException('Forum post not found');
    }

    const user = await this.users.findOneBy({
      id: userId,
      eduVerified: true,
    });

    if (!user) {
      throw new ForbiddenException('A verified account is required');
    }

    // Ignore duplicate likes from the same user.
    await this.likes
      .createQueryBuilder()
      .insert()
      .into(ForumPostLike)
      .values({
        post: { id: postId },
        user: { id: userId },
      })
      .orIgnore()
      .execute();

    return this.getLikeCount(postId);
  }

  async unlikePost(postId: string, userId: string) {
    const post = await this.posts.findOneBy({
      id: postId,
    });

    if (!post) {
      throw new NotFoundException('Forum post not found');
    }

    await this.likes
      .createQueryBuilder()
      .delete()
      .from(ForumPostLike)
      .where('post_id = :postId', { postId })
      .andWhere('user_id = :userId', { userId })
      .execute();

    return this.getLikeCount(postId);
  }

  async getLikeCount(postId: string) {
    const post = await this.posts.findOneBy({
      id: postId,
    });

    if (!post) {
      throw new NotFoundException('Forum post not found');
    }

    const likeCount = await this.likes.count({
      where: {
        post: { id: postId },
      },
    });

    return {
      postId,
      likeCount,
    };
  }
}

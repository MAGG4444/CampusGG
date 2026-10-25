import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { User } from '../users/user.entity';
import { ForumPost } from './forum-post.entity';
import { ForumComment } from './forum-comment.entity';
import { CreateForumCommentDto } from './dto/create-forum-comment.dto';
import { UpdateForumCommentDto } from './dto/update-forum-comment.dto';

@Injectable()
export class ForumCommentsService {
  constructor(
    @InjectRepository(ForumComment)
    private readonly comments: Repository<ForumComment>,

    @InjectRepository(ForumPost)
    private readonly posts: Repository<ForumPost>,

    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

  async create(postId: string, dto: CreateForumCommentDto, userId: string) {
    const post = await this.posts.findOneBy({
      id: postId,
    });

    if (!post) {
      throw new NotFoundException('Forum post not found');
    }

    const author = await this.users.findOneBy({
      id: userId,
      eduVerified: true,
    });

    if (!author) {
      throw new ForbiddenException('A verified account is required');
    }

    const comment = this.comments.create({
      content: dto.content.trim(),
      post,
      author,
    });

    const saved = await this.comments.save(comment);

    return {
      id: saved.id,
      content: saved.content,
      author: {
        id: author.id,
        username: author.username,
        displayName: author.displayName,
      },
      createdAt: saved.createdAt,
      updatedAt: saved.updatedAt,
    };
  }

  async findAll(postId: string, page = 1, limit = 20) {
    const post = await this.posts.findOneBy({
      id: postId,
    });

    if (!post) {
      throw new NotFoundException('Forum post not found');
    }

    const safePage = Math.max(1, page);
    const safeLimit = Math.min(50, Math.max(1, limit));

    const [comments, total] = await this.comments
      .createQueryBuilder('comment')
      .innerJoin('comment.post', 'post')
      .innerJoin('comment.author', 'author')
      .select([
        'comment.id',
        'comment.content',
        'comment.createdAt',
        'comment.updatedAt',
        'author.id',
        'author.username',
        'author.displayName',
      ])
      .where('post.id = :postId', { postId })
      .orderBy('comment.createdAt', 'ASC')
      .addOrderBy('comment.id', 'ASC')
      .skip((safePage - 1) * safeLimit)
      .take(safeLimit)
      .getManyAndCount();

    return {
      comments,
      total,
      page: safePage,
      limit: safeLimit,
    };
  }

  async update(
    postId: string,
    commentId: string,
    dto: UpdateForumCommentDto,
    userId: string,
  ) {
    const comment = await this.comments.findOne({
      where: {
        id: commentId,
        post: { id: postId },
      },
      relations: {
        author: true,
      },
    });

    if (!comment) {
      throw new NotFoundException('Forum comment not found');
    }

    // Verify comment ownership
    if (comment.author.id !== userId) {
      throw new ForbiddenException("You cannot edit another user's comment");
    }

    comment.content = dto.content.trim();

    const updated = await this.comments.save(comment);

    return {
      id: updated.id,
      content: updated.content,
      author: {
        id: comment.author.id,
        username: comment.author.username,
        displayName: comment.author.displayName,
      },
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }

  async remove(postId: string, commentId: string, userId: string) {
    const comment = await this.comments.findOne({
      where: {
        id: commentId,
        post: { id: postId },
      },
      relations: {
        author: true,
      },
    });

    if (!comment) {
      throw new NotFoundException('Forum comment not found');
    }

    // Verify comment ownership
    if (comment.author.id !== userId) {
      throw new ForbiddenException("You cannot delete another user's comment");
    }

    await this.comments.remove(comment);

    return {
      message: 'Forum comment deleted successfully',
    };
  }
}

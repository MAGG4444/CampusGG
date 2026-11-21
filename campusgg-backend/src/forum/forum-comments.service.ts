import {
  ForbiddenException,
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { User } from '../users/user.entity';
import { ForumPost } from './forum-post.entity';
import { ForumComment } from './forum-comment.entity';
import { ForumCommentLike } from './forum-comment-like.entity';
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
    @InjectRepository(ForumCommentLike)
    private readonly likes: Repository<ForumCommentLike>,
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

    return this.comments.manager.transaction(async (manager) => {
      const comments = manager.getRepository(ForumComment);
      if (dto.parentReplyId) {
        const parent = await comments
          .createQueryBuilder('comment')
          .where('comment.id = :id AND comment.post_id = :postId', {
            id: dto.parentReplyId,
            postId,
          })
          .setLock('pessimistic_write')
          .getOne();
        if (!parent || parent.deletedAt)
          throw new NotFoundException('Parent comment not found');
      }
      const comment = comments.create({
        content: dto.content.trim(),
        post,
        author,
        parentReplyId: dto.parentReplyId ?? null,
      });

      const saved = await comments.save(comment);

      return {
        id: saved.id,
        content: saved.content,
        parentReplyId: saved.parentReplyId,
        likeCount: 0,
        author: {
          id: author.id,
          username: author.username,
          displayName: author.displayName,
        },
        createdAt: saved.createdAt,
        updatedAt: saved.updatedAt,
      };
    });
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
      .leftJoin('comment.author', 'author')
      .select([
        'comment.id',
        'comment.content',
        'comment.parentReplyId',
        'comment.deletedAt',
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

    const counts = comments.length
      ? await this.likes
          .createQueryBuilder('likes')
          .select('likes.comment_id', 'id')
          .addSelect('COUNT(*)', 'count')
          .where('likes.comment_id IN (:...ids)', {
            ids: comments.map((item) => item.id),
          })
          .groupBy('likes.comment_id')
          .getRawMany<{ id: string; count: string }>()
      : [];
    const countMap = new Map(counts.map((row) => [row.id, Number(row.count)]));
    return {
      comments: comments.map((comment) =>
        comment.deletedAt
          ? {
              id: comment.id,
              content: '',
              author: null,
              parentReplyId: comment.parentReplyId,
              createdAt: comment.createdAt,
              updatedAt: comment.updatedAt,
              deletedAt: comment.deletedAt,
              likeCount: 0,
            }
          : { ...comment, likeCount: countMap.get(comment.id) ?? 0 },
      ),
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
    return this.comments.manager.transaction(async (manager) => {
      const comments = manager.getRepository(ForumComment);
      const comment = await comments
        .createQueryBuilder('comment')
        .leftJoinAndSelect('comment.author', 'author')
        .where('comment.id = :commentId AND comment.post_id = :postId', {
          commentId,
          postId,
        })
        .setLock('pessimistic_write', undefined, ['comment'])
        .getOne();

      if (!comment || comment.deletedAt || !comment.author) {
        throw new NotFoundException('Forum comment not found');
      }

      // Verify comment ownership
      if (comment.author.id !== userId) {
        throw new ForbiddenException("You cannot edit another user's comment");
      }

      comment.content = dto.content.trim();

      const updated = await comments.save(comment);

      return {
        id: updated.id,
        content: updated.content,
        parentReplyId: updated.parentReplyId,
        author: {
          id: comment.author.id,
          username: comment.author.username,
          displayName: comment.author.displayName,
        },
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      };
    });
  }

  async remove(postId: string, commentId: string, userId: string) {
    return this.comments.manager.transaction(async (manager) => {
      const comments = manager.getRepository(ForumComment);
      const comment = await comments
        .createQueryBuilder('comment')
        .leftJoinAndSelect('comment.author', 'author')
        .where('comment.id = :commentId AND comment.post_id = :postId', {
          commentId,
          postId,
        })
        .setLock('pessimistic_write', undefined, ['comment'])
        .getOne();
      if (!comment || comment.deletedAt || !comment.author)
        throw new NotFoundException('Forum comment not found');
      if (comment.author.id !== userId)
        throw new ForbiddenException(
          "You cannot delete another user's comment",
        );
      const children = await comments.count({
        where: { parentReplyId: commentId },
      });
      const removedIds: string[] = [];
      if (children) {
        await manager
          .getRepository(ForumCommentLike)
          .delete({ comment: { id: commentId } });
        comment.content = '';
        comment.author = null;
        comment.deletedAt = new Date();
        await comments.save(comment);
      } else {
        let parentId = comment.parentReplyId;
        removedIds.push(commentId);
        await comments.remove(comment);
        while (parentId) {
          const parent = await comments
            .createQueryBuilder('comment')
            .where('comment.id = :id', { id: parentId })
            .setLock('pessimistic_write')
            .getOne();
          if (
            !parent ||
            !parent.deletedAt ||
            (await comments.count({ where: { parentReplyId: parentId } }))
          )
            break;
          parentId = parent.parentReplyId;
          removedIds.push(parent.id);
          await comments.remove(parent);
        }
      }
      return {
        message: 'Forum comment deleted successfully',
        tombstone: Boolean(children),
        removedIds,
      };
    });
  }

  async likedIds(postId: string, userId: string) {
    const rows = await this.likes
      .createQueryBuilder('likes')
      .innerJoin('likes.comment', 'comment')
      .innerJoin('comment.post', 'post')
      .select('comment.id', 'id')
      .where(
        'post.id = :postId AND likes.user_id = :userId AND comment.deleted_at IS NULL',
        {
          postId,
          userId,
        },
      )
      .getRawMany<{ id: string }>();
    return { ids: rows.map((row) => row.id) };
  }

  async setLike(
    postId: string,
    commentId: string,
    userId: string,
    liked: boolean,
  ) {
    return this.comments.manager.transaction(async (manager) => {
      const likes = manager.getRepository(ForumCommentLike);
      const comment = await manager
        .getRepository(ForumComment)
        .createQueryBuilder('comment')
        .where('comment.id = :commentId AND comment.post_id = :postId', {
          commentId,
          postId,
        })
        .setLock('pessimistic_write')
        .getOne();
      if (!comment || comment.deletedAt)
        throw new NotFoundException('Forum comment not found');
      if (comment.parentReplyId)
        throw new BadRequestException('Subreplies cannot be liked');
      if (liked) {
        await likes
          .createQueryBuilder()
          .insert()
          .values({ comment: { id: commentId }, user: { id: userId } })
          .orIgnore()
          .execute();
      } else {
        await likes.delete({
          comment: { id: commentId },
          user: { id: userId },
        });
      }
      const likeCount = await likes.count({
        where: { comment: { id: commentId } },
      });
      return { liked, likeCount };
    });
  }
}

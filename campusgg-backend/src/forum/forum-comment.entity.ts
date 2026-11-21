import {
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

import { User } from '../users/user.entity';
import { ForumPost } from './forum-post.entity';

@Entity('forum_comments')
@Index('IDX_forum_comments_post', ['post'])
export class ForumComment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  content!: string;

  @ManyToOne(() => ForumPost, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'post_id' })
  post!: ForumPost;

  @ManyToOne(() => User, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'author_id' })
  author!: User | null;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;

  @Column({ name: 'parent_reply_id', type: 'uuid', nullable: true })
  parentReplyId!: string | null;

  @ManyToOne(() => ForumComment, { nullable: true, onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'parent_reply_id' })
  parentReply!: ForumComment | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}

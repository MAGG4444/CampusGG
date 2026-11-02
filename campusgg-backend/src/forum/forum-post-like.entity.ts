
import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Unique,
} from 'typeorm';

import { User } from '../users/user.entity';
import { ForumPost } from './forum-post.entity';

@Entity('forum_post_likes')
@Unique('UQ_forum_post_user_like', ['post', 'user'])
export class ForumPostLike {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => ForumPost, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'post_id' })
  post!: ForumPost;

  @ManyToOne(() => User, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}

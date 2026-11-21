import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { User } from '../users/user.entity';
import { ForumComment } from './forum-comment.entity';

@Entity('forum_comment_likes')
@Unique('UQ_forum_comment_user_like', ['comment', 'user'])
export class ForumCommentLike {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => ForumComment, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'comment_id' })
  comment!: ForumComment;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;
}

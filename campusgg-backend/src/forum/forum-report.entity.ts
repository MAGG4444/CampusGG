import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import { ForumPost } from './forum-post.entity';
import { ForumComment } from './forum-comment.entity';

@Entity('forum_reports')
export class ForumReport {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reporter_id' })
  reporter!: User;
  @ManyToOne(() => ForumPost, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'post_id' })
  post!: ForumPost;
  @ManyToOne(() => ForumComment, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'comment_id' })
  comment!: ForumComment | null;
  @Column({ length: 40 }) reason!: string;
  @Column({ name: 'custom_reason', type: 'text', nullable: true })
  customReason!: string | null;
  @Column({ type: 'text', nullable: true }) details!: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

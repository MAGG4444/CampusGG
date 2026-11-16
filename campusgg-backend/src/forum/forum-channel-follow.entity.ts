import {
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import { ForumChannel } from './forum-channel.entity';

@Entity('forum_channel_follows')
@Index('IDX_forum_channel_follows_channel', ['channelId'])
export class ForumChannelFollow {
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @PrimaryColumn({ name: 'channel_id', type: 'varchar', length: 64 })
  channelId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @ManyToOne(() => ForumChannel, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'channel_id' })
  channel!: ForumChannel;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

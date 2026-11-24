import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

@Entity('direct_messages')
@Index('IDX_direct_messages_pair_order', ['pairKey', 'createdAt', 'id'])
@Index('IDX_direct_messages_unread', ['recipientId', 'pairKey', 'readAt'])
@Check('CHK_direct_messages_distinct', '"sender_id" <> "recipient_id"')
@Check(
  'CHK_direct_messages_pair',
  `"pair_key" = LEAST("sender_id", "recipient_id")::text || ':' || GREATEST("sender_id", "recipient_id")::text`,
)
@Check(
  'CHK_direct_messages_content',
  'char_length(btrim("content")) BETWEEN 1 AND 2000',
)
export class DirectMessage {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'PK_direct_messages',
  })
  id!: string;

  @Column({ name: 'sender_id', type: 'uuid' })
  senderId!: string;

  @Column({ name: 'recipient_id', type: 'uuid' })
  recipientId!: string;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'sender_id',
    foreignKeyConstraintName: 'FK_direct_messages_sender',
  })
  sender!: User;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'recipient_id',
    foreignKeyConstraintName: 'FK_direct_messages_recipient',
  })
  recipient!: User;

  @Column({ name: 'pair_key', type: 'varchar', length: 73 })
  pairKey!: string;

  @Column({ type: 'varchar', length: 2000 })
  content!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'read_at', type: 'timestamptz', nullable: true })
  readAt!: Date | null;
}

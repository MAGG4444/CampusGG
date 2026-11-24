import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

export type ConnectionStatus = 'pending' | 'accepted';
export type Relationship = 'none' | 'incoming' | 'outgoing' | 'friend';

@Entity('connections')
@Index('UQ_connections_pair_key', ['pairKey'], { unique: true })
@Index('IDX_connections_requester_status', ['requesterId', 'status'])
@Index('IDX_connections_recipient_status', ['recipientId', 'status'])
@Check('CHK_connections_distinct_users', '"requester_id" <> "recipient_id"')
@Check('CHK_connections_status', "\"status\" IN ('pending', 'accepted')")
@Check(
  'CHK_connections_pair_key',
  '"pair_key" = LEAST("requester_id", "recipient_id")::text || \':\' || GREATEST("requester_id", "recipient_id")::text',
)
export class Connection {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'PK_connections',
  })
  id!: string;

  @Column({ name: 'requester_id', type: 'uuid' })
  requesterId!: string;

  @Column({ name: 'recipient_id', type: 'uuid' })
  recipientId!: string;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'requester_id',
    foreignKeyConstraintName: 'FK_connections_requester',
  })
  requester!: User;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'recipient_id',
    foreignKeyConstraintName: 'FK_connections_recipient',
  })
  recipient!: User;

  @Column({ name: 'pair_key', type: 'varchar', length: 73 })
  pairKey!: string;

  @Column({ type: 'varchar', length: 8, default: 'pending' })
  status!: ConnectionStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

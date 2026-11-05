import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Lobby } from './lobby.entity';
import { User } from '../users/user.entity';

@Entity('lobby_messages')
@Index('IDX_lobby_messages_order', ['lobby', 'createdAt', 'id'])
export class LobbyMessage {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Lobby, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lobby_id' })
  lobby!: Lobby;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sender_id' })
  sender!: User;

  @Column({ type: 'varchar', length: 2000 })
  content!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

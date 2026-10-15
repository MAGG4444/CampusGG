import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

import { Lobby } from './lobby.entity';
import { User } from '../users/user.entity';

export enum LobbyMemberRole {
  HOST = 'host',
  MEMBER = 'member',
}

@Entity('lobby_members')
@Unique('UQ_lobby_members_lobby_user', ['lobby', 'user'])
export class LobbyMember {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Lobby, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'lobby_id' })
  lobby!: Lobby;

  @ManyToOne(() => User, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({
    type: 'varchar',
    length: 10,
    default: LobbyMemberRole.MEMBER,
  })
  role!: LobbyMemberRole;

  @CreateDateColumn({ name: 'joined_at' })
  joinedAt!: Date;
}

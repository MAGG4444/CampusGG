import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { User } from '../users/user.entity';

export enum LobbyVisibility {
  PUBLIC = 'public',
  PRIVATE = 'private',
  FRIENDS = 'friends',
}

@Entity('lobbies')
export class Lobby {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'lobby_name', length: 60 })
  lobbyName!: string;

  @Column({
    type: 'varchar',
    length: 160,
    nullable: true,
  })
  subtitle!: string | null;

  @Column({ type: 'varchar', length: 500 })
  details!: string;

  @Column({ type: 'text', array: true })
  tags!: string[];

  @Column({
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  game!: string | null;

  @Column({
    name: 'skill_level',
    type: 'varchar',
    length: 30,
    nullable: true,
  })
  skillLevel!: string | null;

  @Column({
    name: 'participant_limit',
    type: 'integer',
    nullable: true,
  })
  participantLimit!: number | null;

  @Column({
    type: 'enum',
    enum: LobbyVisibility,
    default: LobbyVisibility.PUBLIC,
  })
  visibility!: LobbyVisibility;

  @ManyToOne(() => User, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'host_id' })
  host!: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}

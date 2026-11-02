import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import type { PlayerMatchmakingInput } from '../schemas/player-matchmaking.schema.js';

/**
 * State machine for a player's matchmaking lifecycle.
 *
 * A row is created as `queued`, then atomically transitions to `matched`
 * when a tick commits a lobby for the player. The row is kept for the
 * match-result TTL so clients can recover a lost poll response, then removed
 * by the cleanup pass.
 */
export enum MatchmakingStatus {
  QUEUED = 'queued',
  MATCHED = 'matched',
}

/**
 * PostgreSQL-backed matchmaking queue entry.
 *
 * Exactly one row may exist per user. The unique `user_id` index is the
 * concurrency guard: two API instances cannot enqueue the same user twice,
 * and a queued row cannot coexist with an unexpired match result.
 */
@Entity('matchmaking_entries')
@Index('UQ_matchmaking_entries_user', ['userId'], { unique: true })
@Index('IDX_matchmaking_entries_game_status_enqueued', [
  'game',
  'status',
  'enqueuedAt',
])
@Index('IDX_matchmaking_entries_status_heartbeat', ['status', 'heartbeatAt'])
@Index('IDX_matchmaking_entries_status_expires', ['status', 'matchExpiresAt'])
export class MatchmakingEntry {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ type: 'varchar', length: 50 })
  game!: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: MatchmakingStatus.QUEUED,
  })
  status!: MatchmakingStatus;

  /** Validated player payload captured at enqueue time. */
  @Column({ type: 'jsonb' })
  payload!: PlayerMatchmakingInput;

  @Column({ name: 'enqueued_at', type: 'timestamptz' })
  enqueuedAt!: Date;

  /** Updated by the client's poll; stale entries are removed after 2 minutes. */
  @Column({ name: 'heartbeat_at', type: 'timestamptz' })
  heartbeatAt!: Date;

  @Column({ name: 'matched_at', type: 'timestamptz', nullable: true })
  matchedAt!: Date | null;

  @Column({ name: 'match_expires_at', type: 'timestamptz', nullable: true })
  matchExpiresAt!: Date | null;

  @Column({ name: 'lobby_id', type: 'uuid', nullable: true })
  lobbyId!: string | null;

  @Column({ name: 'group_id', type: 'varchar', length: 60, nullable: true })
  groupId!: string | null;

  @Column({ type: 'double precision', nullable: true })
  score!: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

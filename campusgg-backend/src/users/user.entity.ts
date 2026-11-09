import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export interface GamingProfile {
  game: string;
  preferredRoles: string[];
  experienceLevel: string;
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  email!: string;

  @Column({ unique: true, length: 50 })
  username!: string;

  @Column({ name: 'display_name', length: 100, nullable: true })
  displayName!: string;

  @Column({ type: 'varchar', length: 500, default: '' })
  bio?: string;

  @Index('UQ_users_steam_id', { unique: true })
  @Column({ name: 'steam_id', type: 'varchar', length: 17, nullable: true })
  steamId?: string | null;

  @Column({ name: 'steam_linked_at', type: 'timestamptz', nullable: true })
  steamLinkedAt?: Date | null;

  @Column({ name: 'steam_synced_at', type: 'timestamptz', nullable: true })
  steamSyncedAt?: Date | null;

  @Column({
    name: 'steam_cs2_playtime_minutes',
    type: 'integer',
    nullable: true,
  })
  steamCs2PlaytimeMinutes?: number | null;

  @Column({
    name: 'steam_dota2_playtime_minutes',
    type: 'integer',
    nullable: true,
  })
  steamDota2PlaytimeMinutes?: number | null;

  @Column({
    name: 'gaming_profiles',
    type: 'jsonb',
    default: () => "'[]'::jsonb",
  })
  gamingProfiles?: GamingProfile[];

  @Column({ name: 'edu_verified', default: false })
  eduVerified!: boolean;

  @Index()
  @Column({
    name: 'verification_token',
    type: 'varchar',
    nullable: true,
    select: false,
  })
  verificationToken!: string | null;

  @Column({ name: 'token_expires_at', type: 'timestamptz', nullable: true })
  tokenExpiresAt!: Date | null;

  @Column({ nullable: true, select: false })
  password?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}

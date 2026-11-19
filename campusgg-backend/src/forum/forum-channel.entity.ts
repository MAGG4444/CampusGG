import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('forum_channels')
export class ForumChannel {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  id!: string;

  @Column({ type: 'varchar', length: 64, unique: true })
  slug!: string;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  // Lowercase, trimmed historical values. IDs and slugs remain stable if names change.
  @Column({ type: 'text', array: true })
  aliases!: string[];
}

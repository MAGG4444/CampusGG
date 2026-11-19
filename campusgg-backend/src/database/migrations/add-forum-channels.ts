import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddForumChannels1792368006000 implements MigrationInterface {
  name = 'AddForumChannels1792368006000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const schema =
      (queryRunner.connection.options as { schema?: string }).schema ??
      'public';
    const table = `${queryRunner.connection.driver.escape(schema)}."forum_channels"`;
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS ${table} (
      "id" varchar(64) PRIMARY KEY, "slug" varchar(64) NOT NULL UNIQUE,
      "name" varchar(100) NOT NULL, "aliases" text[] NOT NULL
    )`);
    const channels: Array<[string, string, string, string[]]> = [
      ['valorant', 'valorant', 'Valorant', ['valorant']],
      [
        'counter-strike-2',
        'counter-strike-2',
        'CS2',
        ['cs2', 'counter-strike 2', 'counter strike 2'],
      ],
      ['minecraft', 'minecraft', 'Minecraft', ['minecraft']],
      [
        'league-of-legends',
        'league-of-legends',
        'League of Legends',
        ['league of legends', 'lol'],
      ],
      ['dota', 'dota', 'Dota', ['dota', 'dota 2', 'dota2']],
      ['overwatch-2', 'overwatch-2', 'OW2', ['ow2', 'overwatch 2']],
      ['rocket-league', 'rocket-league', 'Rocket League', ['rocket league']],
      ['it-takes-two', 'it-takes-two', 'It Takes Two', ['it takes two']],
    ];
    for (const [id, slug, name, aliases] of channels) {
      await queryRunner.query(
        `INSERT INTO ${table} (id, slug, name, aliases) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING`,
        [id, slug, name, aliases],
      );
    }

    // Do not silently accept pre-existing conflicting channel identities.
    const rows = (await queryRunner.query(
      `SELECT id, slug, name, aliases FROM ${table}`,
    )) as Array<{ id: string; slug: string; name: string; aliases: string[] }>;
    const slugs = new Set<string>();
    const aliases = new Set<string>();
    for (const row of rows) {
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(row.slug) || slugs.has(row.slug)) {
        throw new Error(`Invalid or duplicate channel slug: ${row.slug}`);
      }
      slugs.add(row.slug);
      if (
        !Array.isArray(row.aliases) ||
        !row.aliases.includes(row.name.trim().toLowerCase())
      ) {
        throw new Error(
          `Channel ${row.id} must include its canonical name as an alias.`,
        );
      }
      for (const alias of row.aliases) {
        if (
          !alias ||
          alias !== alias.trim().toLowerCase() ||
          aliases.has(alias)
        ) {
          throw new Error(`Invalid or duplicate channel alias: ${alias}`);
        }
        aliases.add(alias);
      }
    }
    for (const [id, slug] of channels) {
      if (!rows.some((row) => row.id === id && row.slug === slug)) {
        throw new Error(`Conflicting channel identity: ${id}`);
      }
    }
  }

  down(): Promise<void> {
    // Channel identities may be referenced by future features; do not delete them.
    return Promise.reject(
      new Error('Forum channel identities cannot be reverted safely.'),
    );
  }
}

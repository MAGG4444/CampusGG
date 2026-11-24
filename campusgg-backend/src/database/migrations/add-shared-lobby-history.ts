import { MigrationInterface, QueryRunner } from 'typeorm';

// This table and trigger are migration-managed, not synchronized by TypeORM.
export class AddSharedLobbyHistory1792368015000 implements MigrationInterface {
  name = 'AddSharedLobbyHistory1792368015000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const schema =
      (queryRunner.connection.options as { schema?: string }).schema ??
      'public';
    const s = queryRunner.connection.driver.escape(schema);
    const history = `${s}."shared_lobby_history"`;
    // Serialize backfill with live membership inserts/deletes.
    await queryRunner.query(
      `LOCK TABLE ${s}."lobby_members" IN SHARE ROW EXCLUSIVE MODE`,
    );
    await queryRunner.query(`CREATE TABLE ${history} (
      lobby_id uuid NOT NULL,
      user_low uuid NOT NULL REFERENCES ${s}."users"(id) ON DELETE CASCADE,
      user_high uuid NOT NULL REFERENCES ${s}."users"(id) ON DELETE CASCADE,
      lobby_name varchar(60) NOT NULL,
      game varchar(50),
      shared_at timestamptz NOT NULL,
      PRIMARY KEY (lobby_id, user_low, user_high),
      CHECK (user_low < user_high)
    )`);
    await queryRunner.query(
      `CREATE INDEX "IDX_shared_lobby_low" ON ${history} (user_low, shared_at DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_shared_lobby_high" ON ${history} (user_high, shared_at DESC)`,
    );
    // Only currently overlapping memberships can be recovered; deleted lobbies cannot.
    await queryRunner.query(`INSERT INTO ${history} (lobby_id, user_low, user_high, lobby_name, game, shared_at)
      SELECT l.id, a.user_id, b.user_id, l.lobby_name, l.game, GREATEST(a.joined_at, b.joined_at)
      FROM ${s}."lobby_members" a
      JOIN ${s}."lobby_members" b ON a.lobby_id = b.lobby_id AND a.user_id < b.user_id
      JOIN ${s}."lobbies" l ON l.id = a.lobby_id`);
    // The application already locks the lobby during join/leave/delete. Each
    // successful INSERT records only users currently sharing that lobby.
    await queryRunner.query(`CREATE FUNCTION ${s}."record_shared_lobby"() RETURNS trigger
      LANGUAGE plpgsql AS $body$
      BEGIN
        INSERT INTO ${history} (lobby_id, user_low, user_high, lobby_name, game, shared_at)
        SELECT l.id, LEAST(NEW.user_id, m.user_id), GREATEST(NEW.user_id, m.user_id),
          l.lobby_name, l.game, clock_timestamp()
        FROM ${s}."lobby_members" m
        JOIN ${s}."lobbies" l ON l.id = NEW.lobby_id
        WHERE m.lobby_id = NEW.lobby_id AND m.user_id <> NEW.user_id
        ON CONFLICT (lobby_id, user_low, user_high) DO UPDATE SET
          shared_at = GREATEST(shared_lobby_history.shared_at, EXCLUDED.shared_at),
          lobby_name = EXCLUDED.lobby_name, game = EXCLUDED.game;
        RETURN NEW;
      END;
      $body$`);
    await queryRunner.query(`CREATE TRIGGER "record_shared_lobby_after_insert"
      AFTER INSERT ON ${s}."lobby_members"
      FOR EACH ROW EXECUTE FUNCTION ${s}."record_shared_lobby"()`);
  }

  down(): Promise<void> {
    return Promise.reject(
      new Error(
        'Shared lobby history contains user data. Use a reviewed backup and recovery plan instead of dropping it.',
      ),
    );
  }
}

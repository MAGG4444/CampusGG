import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserGamingProfiles1792368002000 implements MigrationInterface {
  name = 'AddUserGamingProfiles1792368002000';

  private usersTable(queryRunner: QueryRunner): string {
    const schema =
      (queryRunner.connection.options as { schema?: string }).schema ??
      'public';
    return `${queryRunner.connection.driver.escape(schema)}."users"`;
  }

  async up(queryRunner: QueryRunner): Promise<void> {
    const users = this.usersTable(queryRunner);
    await queryRunner.query(`ALTER TABLE ${users}
      ADD COLUMN IF NOT EXISTS "preferred_roles" jsonb NOT NULL DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS "gaming_profiles" jsonb NOT NULL DEFAULT '[]'::jsonb`);

    await queryRunner.query(`UPDATE ${users} AS users
      SET "gaming_profiles" = migrated.profiles
      FROM (
        SELECT source.id, COALESCE(jsonb_agg(jsonb_build_object(
          'game', games.game,
          'preferredRoles', COALESCE((
            SELECT jsonb_agg(legacy_role.role)
            FROM jsonb_array_elements_text(
              COALESCE(role_selection.selection->'roles', '[]'::jsonb)
            ) AS legacy_role(role)
            WHERE CASE lower(games.game)
              WHEN 'valorant' THEN legacy_role.role IN (
                'Duelist', 'Initiator', 'Controller', 'Sentinel'
              )
              WHEN 'league of legends' THEN legacy_role.role IN (
                'Top', 'Jungle', 'Mid', 'ADC', 'Support'
              )
              WHEN 'overwatch 2' THEN legacy_role.role IN (
                'Tank', 'Damage', 'Support'
              )
              ELSE legacy_role.role IN (
                'Leader', 'Strategist', 'Support', 'Flex'
              )
            END
          ), '[]'::jsonb),
          'experienceLevel', CASE
            WHEN source.skill_level IN ('Beginner', 'Intermediate', 'Advanced')
              THEN source.skill_level
            ELSE 'Beginner'
          END
        ) ORDER BY games.position), '[]'::jsonb) AS profiles
        FROM ${users} AS source
        CROSS JOIN LATERAL unnest(source.favorite_games)
          WITH ORDINALITY AS games(game, position)
        LEFT JOIN LATERAL (
          SELECT selection
          FROM jsonb_array_elements(source.preferred_roles) AS selection
          WHERE lower(selection->>'game') = lower(games.game)
          LIMIT 1
        ) AS role_selection ON true
        GROUP BY source.id
      ) AS migrated
      WHERE users.id = migrated.id
        AND users.gaming_profiles = '[]'::jsonb`);

    await queryRunner.query(`ALTER TABLE ${users}
      DROP COLUMN IF EXISTS "preferred_roles",
      DROP COLUMN IF EXISTS "skill_level",
      DROP COLUMN IF EXISTS "favorite_games"`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const users = this.usersTable(queryRunner);
    await queryRunner.query(`ALTER TABLE ${users}
      ADD COLUMN IF NOT EXISTS "favorite_games" text[] NOT NULL DEFAULT '{}'::text[],
      ADD COLUMN IF NOT EXISTS "skill_level" varchar(20) NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS "preferred_roles" jsonb NOT NULL DEFAULT '[]'::jsonb`);

    await queryRunner.query(`UPDATE ${users}
      SET "favorite_games" = ARRAY(
            SELECT profile->>'game'
            FROM jsonb_array_elements("gaming_profiles") AS profile
          ),
          "skill_level" = COALESCE("gaming_profiles"->0->>'experienceLevel', ''),
          "preferred_roles" = COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
              'game', profile->>'game',
              'roles', profile->'preferredRoles'
            ))
            FROM jsonb_array_elements("gaming_profiles") AS profile
            WHERE jsonb_array_length(profile->'preferredRoles') > 0
          ), '[]'::jsonb)`);

    await queryRunner.query(`ALTER TABLE ${users}
      DROP COLUMN IF EXISTS "gaming_profiles"`);
  }
}

import type { Relationship } from './connection.entity';

export interface RecentPlayer {
  id: string;
  username: string;
  name: string;
  displayName: string;
  bio: string;
  game: string | null;
  experienceLevel: string | null;
  relationship: Relationship;
  sharedLobby: string;
  sharedGame: string | null;
  lastSharedAt: Date;
  sharedSessions: number;
}

// `schema` is a driver-escaped identifier, not a request parameter.
// Only the authenticated viewer's pairs are read; never serialize full users.
export function recentPlayersSql(schema: string): string {
  return `WITH encounters AS (
    SELECT user_high AS other_id, lobby_id, lobby_name, game, shared_at
      FROM ${schema}."shared_lobby_history" WHERE user_low = $1::uuid
    UNION ALL
    SELECT user_low AS other_id, lobby_id, lobby_name, game, shared_at
      FROM ${schema}."shared_lobby_history" WHERE user_high = $1::uuid
  ), ranked AS (
    SELECT *, ROW_NUMBER() OVER (PARTITION BY other_id ORDER BY shared_at DESC, lobby_id DESC) AS rank,
      (COUNT(*) OVER (PARTITION BY other_id))::integer AS session_count
    FROM encounters
  )
  SELECT u.id, u.username, COALESCE(NULLIF(u.display_name, ''), u.username) AS name,
    COALESCE(NULLIF(u.display_name, ''), u.username) AS "displayName", COALESCE(u.bio, '') AS bio,
    u.gaming_profiles->0->>'game' AS game, u.gaming_profiles->0->>'experienceLevel' AS "experienceLevel",
    CASE WHEN c.status = 'accepted' THEN 'friend'
      WHEN c.status = 'pending' AND c.requester_id = $1::uuid THEN 'outgoing'
      WHEN c.status = 'pending' THEN 'incoming' ELSE 'none' END AS relationship,
    r.lobby_name AS "sharedLobby", r.game AS "sharedGame", r.shared_at AS "lastSharedAt",
    r.session_count AS "sharedSessions"
  FROM ranked r
  JOIN ${schema}."users" u ON u.id = r.other_id AND u.edu_verified = true
  LEFT JOIN ${schema}."connections" c ON c.pair_key = LEAST($1::uuid, u.id)::text || ':' || GREATEST($1::uuid, u.id)::text
  WHERE r.rank = 1
  ORDER BY r.shared_at DESC, u.id ASC LIMIT 50`;
}

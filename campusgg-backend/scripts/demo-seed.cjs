/**
 * Demo seed for the lobby recommender.
 *
 * Creates public lobbies with varied game, skill, needed roles, age, and
 * occupancy. Every host and filler is an edu-verified user so Suggested Users
 * has candidates as well.
 *
 * Idempotent: re-running replaces only the lobbies hosted by the demo users.
 * The existing skyyu account receives a demo profile only for games it does
 * not already have.
 *
 * Usage: npm run seed:demo
 */

const { Client } = require('pg')

const DEMO_PASSWORD_NOTE = 'Demo accounts are not meant for interactive login.'

const users = [
  {
    key: 'nova',
    email: 'demo.nova@purdue.edu',
    username: 'demo_nova',
    displayName: 'Nova',
    bio: 'CS2 support main. I call the utility, you take the duel.',
    profiles: [{ game: 'CS2', preferredRoles: ['Support', 'Entry'], experienceLevel: 'Intermediate' }],
  },
  {
    key: 'riven',
    email: 'demo.riven@purdue.edu',
    username: 'demo_riven',
    displayName: 'Riven',
    bio: 'AWPer looking for a consistent scrim five.',
    profiles: [{ game: 'CS2', preferredRoles: ['AWPer'], experienceLevel: 'Advanced' }],
  },
  {
    key: 'ember',
    email: 'demo.ember@purdue.edu',
    username: 'demo_ember',
    displayName: 'Ember',
    bio: 'New to CS2 ranked, here for calm comms and first wins.',
    profiles: [{ game: 'CS2', preferredRoles: ['Support'], experienceLevel: 'Intermediate' }],
  },
  {
    key: 'atlas',
    email: 'demo.atlas@purdue.edu',
    username: 'demo_atlas',
    displayName: 'Atlas',
    bio: 'Valorant controller. I like a plan and a smoke timer.',
    profiles: [{ game: 'Valorant', preferredRoles: ['Controller'], experienceLevel: 'Intermediate' }],
  },
  {
    key: 'moss',
    email: 'demo.moss@umich.edu',
    username: 'demo_moss',
    displayName: 'Moss',
    bio: 'Overwatch flex player. Chill queue, no ego.',
    profiles: [{ game: 'Overwatch 2', preferredRoles: ['Support'], experienceLevel: 'Beginner' }],
  },
  {
    key: 'kite',
    email: 'demo.kite@purdue.edu',
    username: 'demo_kite',
    displayName: 'Kite',
    bio: 'Dota draft enthusiast. Supports who buy smoke.',
    profiles: [{ game: 'Dota 2', preferredRoles: ['Hard Support'], experienceLevel: 'Advanced' }],
  },
  {
    key: 'f1',
    email: 'demo.f1@purdue.edu',
    username: 'demo_f1',
    displayName: 'Iris',
    bio: 'Entry fragger in training.',
    profiles: [{ game: 'CS2', preferredRoles: ['Entry'], experienceLevel: 'Beginner' }],
  },
  {
    key: 'f2',
    email: 'demo.f2@purdue.edu',
    username: 'demo_f2',
    displayName: 'Kai',
    bio: 'Lurker. I show up in the weirdest places.',
    profiles: [{ game: 'CS2', preferredRoles: ['Lurker'], experienceLevel: 'Intermediate' }],
  },
  {
    key: 'f3',
    email: 'demo.f3@purdue.edu',
    username: 'demo_f3',
    displayName: 'Juno',
    bio: 'AWPer with a scrim schedule and too much coffee.',
    profiles: [{ game: 'CS2', preferredRoles: ['AWPer'], experienceLevel: 'Advanced' }],
  },
  {
    key: 'f4',
    email: 'demo.f4@purdue.edu',
    username: 'demo_f4',
    displayName: 'Lux',
    bio: 'Valorant duelist. First in, sometimes first out.',
    profiles: [{ game: 'Valorant', preferredRoles: ['Duelist'], experienceLevel: 'Intermediate' }],
  },
  {
    key: 'f5',
    email: 'demo.f5@illinois.edu',
    username: 'demo_f5',
    displayName: 'Pax',
    bio: 'Sentinel main. I hold the site so you can rotate.',
    profiles: [{ game: 'Valorant', preferredRoles: ['Sentinel'], experienceLevel: 'Beginner' }],
  },
  {
    key: 'f6',
    email: 'demo.f6@purdue.edu',
    username: 'demo_f6',
    displayName: 'Rook',
    bio: 'Overwatch damage player. Flex when needed.',
    profiles: [{ game: 'Overwatch 2', preferredRoles: ['Damage'], experienceLevel: 'Beginner' }],
  },
  {
    key: 'f7',
    email: 'demo.f7@purdue.edu',
    username: 'demo_f7',
    displayName: 'Sable',
    bio: 'Dota carry. Give me space and a stacked creep wave.',
    profiles: [{ game: 'Dota 2', preferredRoles: ['Carry'], experienceLevel: 'Advanced' }],
  },
  {
    key: 'f8',
    email: 'demo.f8@illinois.edu',
    username: 'demo_f8',
    displayName: 'Onyx',
    bio: 'Mid player who actually buys wards.',
    profiles: [{ game: 'Dota 2', preferredRoles: ['Mid'], experienceLevel: 'Intermediate' }],
  },
  {
    key: 'f9',
    email: 'demo.f9@purdue.edu',
    username: 'demo_f9',
    displayName: 'Wren',
    bio: 'Offlane enjoyer. Initiates first, asks later.',
    profiles: [{ game: 'Dota 2', preferredRoles: ['Offlane'], experienceLevel: 'Beginner' }],
  },
  {
    key: 'f10',
    email: 'demo.f10@purdue.edu',
    username: 'demo_f10',
    displayName: 'Vale',
    bio: 'CS2 IGL. I bring the plan and the mid-round reset.',
    profiles: [{ game: 'CS2', preferredRoles: ['IGL'], experienceLevel: 'Intermediate' }],
  },
  {
    key: 'l1',
    email: 'demo.l1@purdue.edu',
    username: 'demo_l1',
    displayName: 'Yuna',
    bio: 'League mid laner. I roam after pushing, not before.',
    profiles: [{ game: 'League of Legends', preferredRoles: ['Mid', 'Top'], experienceLevel: 'Intermediate' }],
  },
  {
    key: 'l2',
    email: 'demo.l2@illinois.edu',
    username: 'demo_l2',
    displayName: 'Cato',
    bio: 'Jungle main. I path toward the lane that actually has priority.',
    profiles: [{ game: 'League of Legends', preferredRoles: ['Jungle'], experienceLevel: 'Advanced' }],
  },
  {
    key: 'l3',
    email: 'demo.l3@purdue.edu',
    username: 'demo_l3',
    displayName: 'Nia',
    bio: 'League support. Wards are a lifestyle, not a suggestion.',
    profiles: [{ game: 'League of Legends', preferredRoles: ['Support', 'ADC'], experienceLevel: 'Beginner' }],
  },
]

const minutes = (value) => value * 60 * 1000
const hours = (value) => value * 60 * 60 * 1000
const days = (value) => value * 24 * 60 * 60 * 1000

const lobbies = [
  {
    host: 'nova',
    name: 'Late Night CS2 Queue',
    subtitle: 'Support wanted for a five-stack',
    details: 'Two more for Premier. Calm comms, default setups, no tilt after a bad half.',
    tags: ['LFG', 'Strategy'],
    game: 'CS2',
    skillLevel: 'Intermediate',
    neededRoles: ['Support', 'Entry'],
    participantLimit: 5,
    ageMs: minutes(30),
    members: ['f1', 'f2', 'f10'],
  },
  {
    host: 'riven',
    name: 'Purdue CS2 Scrims',
    subtitle: 'Advanced scrim block, Tuesday nights',
    details: 'Looking for a support player who can trade and call utility. We review one demo after each block.',
    tags: ['Strategy', 'Tournaments'],
    game: 'CS2',
    skillLevel: 'Advanced',
    neededRoles: ['Support', 'AWPer'],
    participantLimit: 5,
    ageMs: hours(3),
    members: ['f3', 'f5'],
  },
  {
    host: 'ember',
    name: 'First Win of the Day',
    subtitle: 'Low-pressure CS2 ranked',
    details: 'Newer players welcome. We warm up together and stop after two losses. Mic optional.',
    tags: ['LFG'],
    game: 'CS2',
    skillLevel: 'Intermediate',
    neededRoles: ['Support'],
    participantLimit: 5,
    ageMs: minutes(20),
    members: [],
  },
  {
    host: 'atlas',
    name: 'Ranked Duo Grind',
    subtitle: 'Controller main looking for a duelist',
    details: 'Gold/Plat Valorant. We queue together, review one round, and requeue.',
    tags: ['LFG', 'Meta Analysis'],
    game: 'Valorant',
    skillLevel: 'Intermediate',
    neededRoles: ['Controller', 'Duelist'],
    participantLimit: 5,
    ageMs: hours(1),
    members: ['f4'],
  },
  {
    host: 'moss',
    name: 'Flex Queue Chill',
    subtitle: 'Overwatch 2, no ego',
    details: 'Beginner-friendly flex queue. Play your comfort pick, learn one new hero, call it a night.',
    tags: ['LFG'],
    game: 'Overwatch 2',
    skillLevel: 'Beginner',
    neededRoles: ['Support'],
    participantLimit: 3,
    ageMs: days(5),
    members: ['f6'],
  },
  {
    host: 'kite',
    name: 'Dota Draft Lab',
    subtitle: 'Theorycrafting plus a real match',
    details: 'We draft on paper, argue for ten minutes, then queue. Hard support especially welcome.',
    tags: ['Strategy', 'Meta Analysis'],
    game: 'Dota 2',
    skillLevel: 'Advanced',
    neededRoles: ['Hard Support'],
    participantLimit: 5,
    ageMs: days(2),
    members: ['f7', 'f8', 'f9'],
  },
  {
    host: 'l1',
    name: 'League Flex Five',
    subtitle: 'Jungle and support for a full queue',
    details: 'Purdue flex queue. We draft around comfort picks, call one objective at a time, and stop after two losses.',
    tags: ['LFG', 'Strategy'],
    game: 'League of Legends',
    skillLevel: 'Intermediate',
    neededRoles: ['Jungle', 'Support'],
    participantLimit: 5,
    ageMs: minutes(30),
    members: ['l3'],
  },
  {
    host: 'l2',
    name: 'Clash Practice Block',
    subtitle: 'Top and ADC wanted for Tuesday Clash',
    details: 'Advanced lobby. We run one draft, one game, and a short review. Bring a champion pool you can blind pick.',
    tags: ['Strategy', 'Tournaments'],
    game: 'League of Legends',
    skillLevel: 'Advanced',
    neededRoles: ['Top', 'ADC'],
    participantLimit: 5,
    ageMs: hours(4),
    members: [],
  },
]

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()
  const now = Date.now()

  try {
    await client.query('BEGIN')

    const ids = new Map()
    for (const user of users) {
      const result = await client.query(
        `INSERT INTO users (email, username, display_name, bio, edu_verified, gaming_profiles)
         VALUES ($1, $2, $3, $4, true, $5::jsonb)
         ON CONFLICT (email) DO UPDATE SET
           username = EXCLUDED.username,
           display_name = EXCLUDED.display_name,
           bio = EXCLUDED.bio,
           edu_verified = true,
           gaming_profiles = EXCLUDED.gaming_profiles,
           updated_at = now()
         RETURNING id`,
        [
          user.email,
          user.username,
          user.displayName,
          user.bio,
          JSON.stringify(user.profiles),
        ],
      )
      ids.set(user.key, result.rows[0].id)
    }

    // Add a demo profile for each game the viewer does not have yet. Existing
    // game profiles are left untouched.
    const demoViewerProfiles = [
      {
        game: 'CS2',
        preferredRoles: ['Support'],
        experienceLevel: 'Intermediate',
      },
      {
        game: 'Valorant',
        preferredRoles: ['Controller'],
        experienceLevel: 'Intermediate',
      },
      {
        game: 'League of Legends',
        preferredRoles: ['Mid'],
        experienceLevel: 'Intermediate',
      },
      {
        game: 'Dota 2',
        preferredRoles: ['Hard Support'],
        experienceLevel: 'Advanced',
      },
    ]
    for (const profile of demoViewerProfiles) {
      await client.query(
        `UPDATE users
         SET gaming_profiles = COALESCE(gaming_profiles, '[]'::jsonb) || $1::jsonb,
             updated_at = now()
         WHERE email = 'du328@purdue.edu'
           AND NOT EXISTS (
             SELECT 1
             FROM jsonb_array_elements(COALESCE(gaming_profiles, '[]'::jsonb)) AS existing
             WHERE LOWER(existing->>'game') = LOWER($2)
           )`,
        [JSON.stringify([profile]), profile.game],
      )
    }

    const hostIds = [...ids.values()]
    await client.query(
      'DELETE FROM lobby_members WHERE lobby_id IN (SELECT id FROM lobbies WHERE host_id = ANY($1::uuid[]))',
      [hostIds],
    )
    await client.query('DELETE FROM lobbies WHERE host_id = ANY($1::uuid[])', [
      hostIds,
    ])

    const created = []
    for (const lobby of lobbies) {
      const updatedAt = new Date(now - lobby.ageMs)
      const createdAt = new Date(
        Math.min(updatedAt.getTime(), now - lobby.ageMs - hours(1)),
      )
      const result = await client.query(
        `INSERT INTO lobbies
           (lobby_name, subtitle, details, tags, game, skill_level, needed_roles,
            participant_limit, visibility, created_at, updated_at, host_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'public', $9, $10, $11)
         RETURNING id`,
        [
          lobby.name,
          lobby.subtitle,
          lobby.details,
          lobby.tags,
          lobby.game,
          lobby.skillLevel,
          lobby.neededRoles,
          lobby.participantLimit,
          createdAt,
          updatedAt,
          ids.get(lobby.host),
        ],
      )
      const lobbyId = result.rows[0].id
      await client.query(
        `INSERT INTO lobby_members (lobby_id, user_id, role, joined_at)
         VALUES ($1, $2, 'host', $3)`,
        [lobbyId, ids.get(lobby.host), createdAt],
      )
      for (const member of lobby.members) {
        await client.query(
          `INSERT INTO lobby_members (lobby_id, user_id, role, joined_at)
           VALUES ($1, $2, 'member', $3)`,
          [lobbyId, ids.get(member), createdAt],
        )
      }
      created.push({
        name: lobby.name,
        game: lobby.game,
        members: lobby.members.length + 1,
        limit: lobby.participantLimit,
      })
    }

    await client.query('COMMIT')
    console.log('Demo seed complete. ' + DEMO_PASSWORD_NOTE)
    console.table(created)
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    await client.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

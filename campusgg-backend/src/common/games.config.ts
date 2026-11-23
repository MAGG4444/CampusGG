/**
 * Canonical game and role configuration.
 *
 * Profile options, lobby roles, and recommendation scoring must all agree on
 * the same game names and role names. Games not listed here keep their
 * free-form name and fall back to the generic role list.
 */

export interface GameDefinition {
  name: string;
  roles: readonly string[];
  aliases: readonly string[];
  /** Noun used in recommendation reasons, e.g. "lane" for League. */
  roleNoun?: string;
}

export interface GamingProfileLike {
  game: string;
  preferredRoles: string[];
  experienceLevel?: string | null;
}

export const GENERIC_ROLE_OPTIONS = [
  'Leader',
  'Strategist',
  'Support',
  'Flex',
] as const;

export const GAME_DEFINITIONS: readonly GameDefinition[] = [
  {
    name: 'CS2',
    roles: ['IGL', 'Entry', 'AWPer', 'Lurker', 'Support'],
    aliases: ['cs2', 'csgo', 'cs:go', 'counter-strike 2', 'counter strike 2'],
    roleNoun: 'role',
  },
  {
    name: 'Valorant',
    roles: ['Duelist', 'Initiator', 'Controller', 'Sentinel'],
    aliases: ['valorant', 'val'],
    roleNoun: 'role',
  },
  {
    name: 'League of Legends',
    roles: ['Top', 'Jungle', 'Mid', 'ADC', 'Support'],
    aliases: ['league of legends', 'league', 'lol'],
    roleNoun: 'lane',
  },
  {
    name: 'Dota 2',
    roles: ['Carry', 'Mid', 'Offlane', 'Soft Support', 'Hard Support'],
    aliases: ['dota 2', 'dota', 'dota2'],
    roleNoun: 'position',
  },
  {
    name: 'Overwatch 2',
    roles: ['Tank', 'Damage', 'Support'],
    aliases: ['overwatch 2', 'overwatch', 'overwatch2', 'ow2', 'ow'],
    roleNoun: 'role',
  },
  {
    name: 'Rocket League',
    roles: [],
    aliases: ['rocket league', 'rocketleague', 'rl'],
    roleNoun: 'role',
  },
  {
    name: 'It Takes Two',
    roles: [],
    aliases: ['it takes two', 'itt'],
    roleNoun: 'role',
  },
];

const definitionsByAlias = new Map<string, GameDefinition>();

for (const definition of GAME_DEFINITIONS) {
  definitionsByAlias.set(definition.name.toLowerCase(), definition);
  for (const alias of definition.aliases) {
    definitionsByAlias.set(alias.toLowerCase(), definition);
  }
}

function normalizedKey(game?: string | null): string {
  return (game ?? '').trim().toLowerCase();
}

/** Look up a canonical game by name or alias. */
export function findGameDefinition(
  game?: string | null,
): GameDefinition | undefined {
  const key = normalizedKey(game);
  return key ? definitionsByAlias.get(key) : undefined;
}

/**
 * Return the canonical display name, or the trimmed input for free-form games.
 */
export function canonicalGameName(game?: string | null): string {
  const trimmed = (game ?? '').trim();
  return findGameDefinition(trimmed)?.name ?? trimmed;
}

/** Stable key used to compare game names across aliases. */
export function gameKey(game?: string | null): string {
  return normalizedKey(canonicalGameName(game));
}

export function gamesMatch(a?: string | null, b?: string | null): boolean {
  const left = gameKey(a);
  const right = gameKey(b);
  return Boolean(left) && left === right;
}

/**
 * Every spelling a stored game value may use, lowercased. Stored values are
 * normally canonical, but older rows can still contain an alias.
 */
export function gameMatchKeys(game?: string | null): string[] {
  const trimmed = (game ?? '').trim();
  if (!trimmed) return [];
  const definition = findGameDefinition(trimmed);
  if (!definition) return [trimmed.toLowerCase()];
  return [
    ...new Set(
      [definition.name, ...definition.aliases].map((value) =>
        value.toLowerCase(),
      ),
    ),
  ];
}

/** Canonical roles for a game; unknown games use the generic role list. */
export function rolesForGame(game?: string | null): readonly string[] {
  const definition = findGameDefinition(game);
  return definition ? definition.roles : GENERIC_ROLE_OPTIONS;
}

/** Noun used in recommendation copy; unknown games fall back to "role". */
export function roleNounForGame(game?: string | null): string {
  return findGameDefinition(game)?.roleNoun ?? 'role';
}

/** Resolve a role to its canonical spelling, or null when invalid. */
export function canonicalRole(
  game: string | null | undefined,
  role: string,
): string | null {
  const key = role.trim().toLowerCase();
  if (!key) return null;
  const match = rolesForGame(game).find(
    (allowedRole) => allowedRole.toLowerCase() === key,
  );
  return match ?? null;
}

/** Find the viewer's profile entry for a game, matching aliases. */
export function findGamingProfile<T extends GamingProfileLike>(
  profiles: readonly T[] | undefined,
  game?: string | null,
): T | undefined {
  const target = gameKey(game);
  if (!target) return undefined;
  return profiles?.find((profile) => gameKey(profile.game) === target);
}

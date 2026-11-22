import {
  rankLobbyRecommendations,
  scoreLobby,
  type LobbyCandidate,
} from './lobby-scorer';
import { campusDomainFromEmail, skillFit } from './scoring.utils';

const NOW = Date.parse('2026-11-15T12:00:00.000Z');
const HOUR = 3_600_000;

type LobbyOverrides = Partial<Omit<LobbyCandidate, 'host'>> & {
  hostId?: string;
  host?: Partial<LobbyCandidate['host']>;
};

function lobby(overrides: LobbyOverrides = {}): LobbyCandidate {
  const { hostId = 'host-1', host, ...rest } = overrides;
  return {
    id: 'lobby-1',
    lobbyName: 'Test lobby',
    subtitle: null,
    details: 'Test',
    tags: [],
    game: 'CS2',
    skillLevel: 'Intermediate',
    neededRoles: ['Support'],
    participantLimit: 5,
    visibility: 'public',
    createdAt: new Date(NOW - HOUR),
    updatedAt: new Date(NOW - HOUR),
    host: {
      id: hostId,
      username: `host-${hostId}`,
      email: 'host@purdue.edu',
      gamingProfiles: [],
      ...host,
    },
    memberCount: 2,
    ...rest,
  } as unknown as LobbyCandidate;
}

const viewer = {
  email: 'viewer@purdue.edu',
  gamingProfiles: [
    {
      game: 'CS2',
      preferredRoles: ['Support'],
      experienceLevel: 'Intermediate',
    },
  ],
};

describe('scoring utils', () => {
  it('maps same, adjacent, and distant skill levels', () => {
    expect(skillFit('Intermediate', 'Intermediate')).toBe(1);
    expect(skillFit('Beginner', 'Intermediate')).toBe(0.5);
    expect(skillFit('Beginner', 'Advanced')).toBe(0);
    expect(skillFit(null, 'Advanced')).toBe(0.5);
  });

  it('derives a campus domain and never needs the local part', () => {
    expect(campusDomainFromEmail('student@Purdue.EDU')).toBe('purdue.edu');
    expect(campusDomainFromEmail('not-an-email')).toBeNull();
    expect(campusDomainFromEmail(undefined)).toBeNull();
  });
});

describe('scoreLobby', () => {
  it('scores a same-campus lobby with the viewer role as a great fit', () => {
    const result = scoreLobby(lobby({ memberCount: 4 }), viewer, NOW);

    expect(result.parts.skillFit).toBe(1);
    expect(result.parts.roleFit).toBe(1);
    expect(result.parts.campusFit).toBe(1);
    expect(result.fit).toBe('great');
    expect(result.reasons).toContain('Needs Support — your main role');
    expect(result.reasons).toContain('Same skill level: Intermediate');
    expect(result.reasons).toContain('Same campus');
  });

  it('gives the secondary role a lower role fit', () => {
    const result = scoreLobby(
      lobby({ neededRoles: ['Support'] }),
      {
        ...viewer,
        gamingProfiles: [
          {
            game: 'CS2',
            preferredRoles: ['Entry', 'Support'],
            experienceLevel: 'Intermediate',
          },
        ],
      },
      NOW,
    );

    expect(result.parts.roleFit).toBe(0.7);
    expect(result.reasons).toContain('Needs Support — your secondary role');
  });

  it('stays neutral when the lobby lists no roles', () => {
    const result = scoreLobby(lobby({ neededRoles: [] }), viewer, NOW);
    expect(result.parts.roleFit).toBe(0.5);
  });

  it('distinguishes same campus, other .edu, and unknown domains', () => {
    expect(scoreLobby(lobby(), viewer, NOW).parts.campusFit).toBe(1);
    expect(
      scoreLobby(
        lobby({
          host: {
            id: 'host-1',
            username: 'host',
            email: 'host@illinois.edu',
            gamingProfiles: [],
          },
        }),
        viewer,
        NOW,
      ).parts.campusFit,
    ).toBe(0.35);
    expect(
      scoreLobby(lobby(), { ...viewer, email: null }, NOW).parts.campusFit,
    ).toBe(0.5);
  });

  it('falls back to the host profile for the lobby skill level', () => {
    const result = scoreLobby(
      lobby({
        skillLevel: null,
        host: {
          id: 'host-1',
          username: 'host',
          email: 'host@purdue.edu',
          gamingProfiles: [
            {
              game: 'CS2',
              preferredRoles: ['IGL'],
              experienceLevel: 'Intermediate',
            },
          ],
        },
      }),
      viewer,
      NOW,
    );
    expect(result.parts.skillFit).toBe(1);
  });
});

describe('rankLobbyRecommendations', () => {
  it('keeps one lobby per host and sorts by score', () => {
    const results = rankLobbyRecommendations(
      [
        lobby({
          id: 'a',
          hostId: 'host-a',
          updatedAt: new Date(NOW - 30 * HOUR),
        }),
        lobby({ id: 'b', hostId: 'host-a', updatedAt: new Date(NOW - HOUR) }),
        lobby({ id: 'c', hostId: 'host-b', updatedAt: new Date(NOW - HOUR) }),
        lobby({ id: 'd', hostId: 'host-c', updatedAt: new Date(NOW - HOUR) }),
      ],
      viewer,
      { now: NOW },
    );

    expect(results.map(({ lobby: item }) => item.host.id)).toEqual([
      'host-a',
      'host-b',
      'host-c',
    ]);
    expect(results[0].lobby.id).toBe('b');
  });

  it('reserves the third slot for a new or under-filled lobby', () => {
    const results = rankLobbyRecommendations(
      [
        lobby({ id: 'best', hostId: 'host-a', memberCount: 4 }),
        lobby({ id: 'second', hostId: 'host-b', memberCount: 4 }),
        lobby({
          id: 'third-old-full',
          hostId: 'host-c',
          memberCount: 5,
          updatedAt: new Date(NOW - 10 * 24 * HOUR),
        }),
        lobby({
          id: 'explore-new',
          hostId: 'host-d',
          memberCount: 1,
          updatedAt: new Date(NOW - HOUR),
        }),
      ],
      viewer,
      { now: NOW },
    );

    expect(results).toHaveLength(3);
    expect(results[2].lobby.id).toBe('explore-new');
    expect(results[2].exploration).toBe(true);
  });

  it('suppresses lobbies below the minimum score', () => {
    const results = rankLobbyRecommendations(
      [
        lobby({
          skillLevel: 'Advanced',
          neededRoles: ['AWPer'],
          hostId: 'host-a',
          updatedAt: new Date(NOW - 30 * 24 * HOUR),
          host: {
            id: 'host-a',
            username: 'host',
            email: 'host@illinois.edu',
            gamingProfiles: [],
          },
        }),
      ],
      viewer,
      { now: NOW },
    );

    expect(results).toEqual([]);
  });

  it('suppresses lobbies for a game the viewer has not added', () => {
    const results = rankLobbyRecommendations(
      [
        lobby({
          id: 'overwatch',
          hostId: 'host-a',
          game: 'Overwatch 2',
          memberCount: 4,
        }),
      ],
      viewer,
      { now: NOW },
    );

    expect(results).toEqual([]);
  });

  it('returns the requested number of lobbies for limits above three', () => {
    const candidates = Array.from({ length: 6 }, (_, index) =>
      lobby({
        id: `lobby-${index}`,
        hostId: `host-${index}`,
        updatedAt: new Date(NOW - (index + 1) * HOUR),
      }),
    );

    for (const limit of [4, 5, 6, 10]) {
      const results = rankLobbyRecommendations(candidates, viewer, {
        limit,
        now: NOW,
      });
      expect(results).toHaveLength(Math.min(limit, candidates.length));
    }

    const expanded = rankLobbyRecommendations(candidates, viewer, {
      limit: 5,
      now: NOW,
    });
    expect(expanded[2].exploration).toBe(true);
  });

  it('breaks score ties by covered roles and coverage ratio', () => {
    const multiRoleViewer = {
      email: 'viewer@purdue.edu',
      gamingProfiles: [
        {
          game: 'CS2',
          preferredRoles: ['Support', 'IGL'],
          experienceLevel: 'Intermediate',
        },
      ],
    };
    const byCount = rankLobbyRecommendations(
      [
        lobby({
          id: 'one-role',
          hostId: 'host-a',
          neededRoles: ['Support'],
          updatedAt: new Date(NOW - HOUR),
        }),
        lobby({
          id: 'two-roles',
          hostId: 'host-b',
          neededRoles: ['Support', 'IGL'],
          updatedAt: new Date(NOW - HOUR),
        }),
      ],
      multiRoleViewer,
      { limit: 2, now: NOW },
    );

    expect(byCount.map(({ lobby: item }) => item.id)).toEqual([
      'two-roles',
      'one-role',
    ]);

    const byRatio = rankLobbyRecommendations(
      [
        lobby({
          id: 'focused',
          hostId: 'host-a',
          neededRoles: ['Support'],
          updatedAt: new Date(NOW - HOUR),
        }),
        lobby({
          id: 'broad',
          hostId: 'host-b',
          neededRoles: ['Support', 'IGL'],
          updatedAt: new Date(NOW - HOUR),
        }),
      ],
      viewer,
      { limit: 2, now: NOW },
    );

    expect(byRatio.map(({ lobby: item }) => item.id)).toEqual([
      'focused',
      'broad',
    ]);
  });

  it('breaks remaining ties by recent activity', () => {
    const results = rankLobbyRecommendations(
      [
        lobby({
          id: 'a-old',
          hostId: 'host-a',
          updatedAt: new Date(NOW - HOUR - 1_000),
        }),
        lobby({
          id: 'z-new',
          hostId: 'host-z',
          updatedAt: new Date(NOW - HOUR),
        }),
      ],
      viewer,
      { limit: 2, now: NOW },
    );

    expect(results[0].score).toBe(results[1].score);
    expect(results[0].lobby.id).toBe('z-new');
  });

  it('promotes a tied lobby from a different campus', () => {
    const neutralViewer = {
      email: null,
      gamingProfiles: viewer.gamingProfiles,
    };
    const updatedAt = new Date(NOW - HOUR);
    const results = rankLobbyRecommendations(
      [
        lobby({ id: 'a', hostId: 'host-a', updatedAt }),
        lobby({ id: 'b', hostId: 'host-b', updatedAt }),
        lobby({
          id: 'c',
          hostId: 'host-c',
          updatedAt,
          host: {
            id: 'host-c',
            username: 'host-c',
            email: 'host-c@illinois.edu',
            gamingProfiles: [],
          },
        }),
      ],
      neutralViewer,
      { limit: 2, now: NOW },
    );

    expect(results.map(({ lobby: item }) => item.id)).toEqual(['a', 'c']);
  });
});

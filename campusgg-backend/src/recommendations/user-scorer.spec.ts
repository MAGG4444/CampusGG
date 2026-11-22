import { rankSuggestedUsers, scoreSuggestedUser } from './user-scorer';

const viewer = {
  email: 'viewer@purdue.edu',
  gamingProfiles: [
    {
      game: 'CS2',
      preferredRoles: ['IGL'],
      experienceLevel: 'Intermediate',
    },
  ],
};

const candidate = {
  id: 'user-2',
  username: 'alex',
  displayName: 'Alex',
  bio: 'CS2 support main',
  email: 'alex@purdue.edu',
  gamingProfiles: [
    {
      game: 'CS2',
      preferredRoles: ['Support'],
      experienceLevel: 'Intermediate',
    },
  ],
};

describe('scoreSuggestedUser', () => {
  it('rewards complementary roles, matching skill, and same campus', () => {
    const result = scoreSuggestedUser(candidate, viewer, 'CS2', 'complement');

    expect(result.parts.skillFit).toBe(1);
    expect(result.parts.roleFit).toBe(1);
    expect(result.parts.campusFit).toBe(1);
    expect(result.score).toBe(1);
    expect(result.reasons).toContain("Brings roles you don't play");
    expect(result.reasons).toContain('Same skill level: Intermediate');
    expect(result.reasons).toContain('Same campus');
  });

  it('lowers the role fit when every role overlaps', () => {
    const result = scoreSuggestedUser(
      {
        ...candidate,
        gamingProfiles: [
          {
            game: 'CS2',
            preferredRoles: ['IGL'],
            experienceLevel: 'Intermediate',
          },
        ],
      },
      viewer,
      'CS2',
      'complement',
    );

    expect(result.parts.roleFit).toBe(0.6);
    expect(result.reasons).toContain('Plays the same roles');
  });

  it('supports an overlap mode switch', () => {
    expect(
      scoreSuggestedUser(
        {
          ...candidate,
          gamingProfiles: [
            {
              game: 'CS2',
              preferredRoles: ['IGL'],
              experienceLevel: 'Intermediate',
            },
          ],
        },
        viewer,
        'CS2',
        'overlap',
      ).parts.roleFit,
    ).toBe(1);
    expect(
      scoreSuggestedUser(candidate, viewer, 'CS2', 'overlap').parts.roleFit,
    ).toBe(0.2);
  });

  it('stays neutral without role data', () => {
    const result = scoreSuggestedUser(
      {
        ...candidate,
        gamingProfiles: [
          {
            game: 'CS2',
            preferredRoles: [],
            experienceLevel: 'Intermediate',
          },
        ],
      },
      viewer,
      'CS2',
      'complement',
    );
    expect(result.parts.roleFit).toBe(0.5);
  });

  it('ranks and limits candidates', () => {
    const results = rankSuggestedUsers(
      [
        candidate,
        {
          ...candidate,
          id: 'user-3',
          username: 'zoe',
          email: 'zoe@illinois.edu',
          gamingProfiles: [
            {
              game: 'CS2',
              preferredRoles: ['Support'],
              experienceLevel: 'Beginner',
            },
          ],
        },
      ],
      viewer,
      'CS2',
      { limit: 1 },
    );

    expect(results).toHaveLength(1);
    expect(results[0].user.id).toBe('user-2');
  });

  it('prefers more complementary roles when scores tie', () => {
    const activity = new Date('2026-11-15T12:00:00.000Z');
    const results = rankSuggestedUsers(
      [
        {
          ...candidate,
          id: 'one-role',
          username: 'one-role',
          updatedAt: activity,
          gamingProfiles: [
            {
              game: 'CS2',
              preferredRoles: ['Support'],
              experienceLevel: 'Intermediate',
            },
          ],
        },
        {
          ...candidate,
          id: 'two-roles',
          username: 'two-roles',
          updatedAt: activity,
          gamingProfiles: [
            {
              game: 'CS2',
              preferredRoles: ['Support', 'Lurker'],
              experienceLevel: 'Intermediate',
            },
          ],
        },
      ],
      viewer,
      'CS2',
      { limit: 2 },
    );

    expect(results[0].score).toBe(results[1].score);
    expect(results[0].user.id).toBe('two-roles');
  });

  it('prefers a purer complement when complementary counts tie', () => {
    const activity = new Date('2026-11-15T12:00:00.000Z');
    const results = rankSuggestedUsers(
      [
        {
          ...candidate,
          id: 'mixed',
          username: 'mixed',
          updatedAt: activity,
          gamingProfiles: [
            {
              game: 'CS2',
              preferredRoles: ['Support', 'IGL'],
              experienceLevel: 'Intermediate',
            },
          ],
        },
        {
          ...candidate,
          id: 'pure',
          username: 'pure',
          updatedAt: activity,
          gamingProfiles: [
            {
              game: 'CS2',
              preferredRoles: ['Support'],
              experienceLevel: 'Intermediate',
            },
          ],
        },
      ],
      viewer,
      'CS2',
      { limit: 2 },
    );

    expect(results[0].score).toBe(results[1].score);
    expect(results[0].user.id).toBe('pure');
  });

  it('breaks remaining ties by recent activity', () => {
    const older = new Date('2026-11-01T12:00:00.000Z');
    const newer = new Date('2026-11-15T12:00:00.000Z');
    const results = rankSuggestedUsers(
      [
        {
          ...candidate,
          id: 'a-old',
          username: 'a-old',
          updatedAt: older,
        },
        {
          ...candidate,
          id: 'z-new',
          username: 'z-new',
          updatedAt: newer,
        },
      ],
      viewer,
      'CS2',
      { limit: 2 },
    );

    expect(results[0].score).toBe(results[1].score);
    expect(results[0].user.id).toBe('z-new');
  });

  it('promotes a tied candidate from a different campus', () => {
    const neutralViewer = {
      email: null,
      gamingProfiles: viewer.gamingProfiles,
    };
    const activity = new Date('2026-11-15T12:00:00.000Z');
    const results = rankSuggestedUsers(
      [
        {
          ...candidate,
          id: 'a',
          username: 'a',
          email: 'a@purdue.edu',
          updatedAt: activity,
        },
        {
          ...candidate,
          id: 'b',
          username: 'b',
          email: 'b@purdue.edu',
          updatedAt: activity,
        },
        {
          ...candidate,
          id: 'c',
          username: 'c',
          email: 'c@illinois.edu',
          updatedAt: activity,
        },
      ],
      neutralViewer,
      'CS2',
      { limit: 2 },
    );

    expect(results.map(({ user }) => user.username)).toEqual(['a', 'c']);
  });
});

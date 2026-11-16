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
});

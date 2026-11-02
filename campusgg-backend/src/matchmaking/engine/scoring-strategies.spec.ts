import type { PlayerMatchmakingInput } from '../schemas/player-matchmaking.schema.js';
import {
  CasualScoringStrategy,
  CompetitiveScoringStrategy,
  computeRoleSynergyMultiplier,
  scoreIntensityAlignment,
  scoreProfileAffinity,
  scoreSkillCohesion,
} from './scoring-strategies.js';

let userCounter = 0;

function makePlayer(
  overrides: Partial<PlayerMatchmakingInput> = {},
): PlayerMatchmakingInput {
  userCounter += 1;

  return {
    userId: `usr_score_${userCounter}`,
    game: 'CS2',
    profile: {
      universityDomain: 'purdue.edu',
      major: 'Computer Science',
      activeSchedule: 'Weekday Evening',
    },
    stats: { game: 'CS2', rating: 15000 },
    preferences: {
      primaryRole: 'IGL',
      secondaryRole: 'Support',
      micEnabled: true,
    },
    intensity: 0.5,
    ...overrides,
  };
}

function playersWith(
  overrides: Partial<PlayerMatchmakingInput>,
  count = 5,
): PlayerMatchmakingInput[] {
  return Array.from({ length: count }, () => makePlayer(overrides));
}

describe('scoring sub-scores', () => {
  beforeEach(() => {
    userCounter = 0;
  });

  describe('scoreSkillCohesion', () => {
    it('returns 1.0 for a tight rating spread', () => {
      const group = playersWith({ stats: { game: 'CS2', rating: 15000 } });
      expect(scoreSkillCohesion(group)).toBe(1);
    });

    it('floors at 0.2 for a rank-wide spread', () => {
      const group = [
        makePlayer({ stats: { game: 'CS2', rating: 10000 } }),
        ...playersWith({ stats: { game: 'CS2', rating: 25000 } }, 4),
      ];

      expect(scoreSkillCohesion(group)).toBeCloseTo(0.2, 5);
    });

    it('interpolates linearly between the perfect and floor deltas', () => {
      const group = [
        makePlayer({ stats: { game: 'CS2', rating: 15000 } }),
        ...playersWith({ stats: { game: 'CS2', rating: 16250 } }, 4),
      ];

      // delta 1250 -> 1.0 - (750 / 1500) * 0.8 = 0.6
      expect(scoreSkillCohesion(group)).toBeCloseTo(0.6, 5);
    });
  });

  describe('scoreIntensityAlignment', () => {
    it('returns 1.0 when everyone shares the same intensity', () => {
      const group = playersWith({ intensity: 0.5 });
      expect(scoreIntensityAlignment(group)).toBe(1);
    });

    it('returns 0.0 for a casual/try-hard mismatch', () => {
      const group = [
        makePlayer({ intensity: 0 }),
        ...playersWith({ intensity: 1 }, 4),
      ];

      expect(scoreIntensityAlignment(group)).toBeCloseTo(0, 5);
    });

    it('interpolates linearly between the tolerance and full mismatch', () => {
      const group = [
        makePlayer({ intensity: 0.2 }),
        ...playersWith({ intensity: 0.8 }, 4),
      ];

      // delta 0.6 -> 1.0 - (0.4 / 0.8) = 0.5
      expect(scoreIntensityAlignment(group)).toBeCloseTo(0.5, 5);
    });
  });

  describe('scoreProfileAffinity', () => {
    it('returns 1.0 for a full same-university stack', () => {
      const group = playersWith({});
      expect(scoreProfileAffinity(group)).toBe(1);
    });

    it('uses the largest university block as the base score', () => {
      const group = [
        makePlayer({
          profile: {
            universityDomain: 'purdue.edu',
            major: 'Computer Science',
            activeSchedule: 'Weekday Evening',
          },
        }),
        makePlayer({
          profile: {
            universityDomain: 'purdue.edu',
            major: 'Physics',
            activeSchedule: 'Weekday Evening',
          },
        }),
        makePlayer({
          profile: {
            universityDomain: 'purdue.edu',
            major: 'Math',
            activeSchedule: 'Weekday Evening',
          },
        }),
        makePlayer({
          profile: {
            universityDomain: 'illinois.edu',
            major: 'History',
            activeSchedule: 'Weekday Evening',
          },
        }),
        makePlayer({
          profile: {
            universityDomain: 'illinois.edu',
            major: 'English',
            activeSchedule: 'Weekday Evening',
          },
        }),
      ];

      // 3/5 same university, no shared majors
      expect(scoreProfileAffinity(group)).toBeCloseTo(0.6, 5);
    });

    it('adds a bonus for each same-major pair', () => {
      const group = [
        makePlayer({
          profile: {
            universityDomain: 'purdue.edu',
            major: 'Computer Science',
            activeSchedule: 'Weekday Evening',
          },
        }),
        makePlayer({
          profile: {
            universityDomain: 'purdue.edu',
            major: 'Computer Science',
            activeSchedule: 'Weekday Evening',
          },
        }),
        makePlayer({
          profile: {
            universityDomain: 'purdue.edu',
            major: 'Math',
            activeSchedule: 'Weekday Evening',
          },
        }),
        makePlayer({
          profile: {
            universityDomain: 'illinois.edu',
            major: 'History',
            activeSchedule: 'Weekday Evening',
          },
        }),
        makePlayer({
          profile: {
            universityDomain: 'illinois.edu',
            major: 'English',
            activeSchedule: 'Weekday Evening',
          },
        }),
      ];

      // 3/5 same university + one same-major pair
      expect(scoreProfileAffinity(group)).toBeCloseTo(0.7, 5);
    });
  });

  describe('computeRoleSynergyMultiplier', () => {
    it('awards the maximum multiplier for five unique roles', () => {
      const group = [
        makePlayer({
          preferences: {
            primaryRole: 'IGL',
            secondaryRole: 'Support',
            micEnabled: true,
          },
        }),
        makePlayer({
          preferences: {
            primaryRole: 'Entry',
            secondaryRole: 'Support',
            micEnabled: true,
          },
        }),
        makePlayer({
          preferences: {
            primaryRole: 'AWPer',
            secondaryRole: 'Support',
            micEnabled: true,
          },
        }),
        makePlayer({
          preferences: {
            primaryRole: 'Lurker',
            secondaryRole: 'Support',
            micEnabled: true,
          },
        }),
        makePlayer({
          preferences: {
            primaryRole: 'Support',
            secondaryRole: 'IGL',
            micEnabled: true,
          },
        }),
      ];

      expect(computeRoleSynergyMultiplier(group)).toBeCloseTo(1.1, 5);
    });

    it('awards a partial multiplier for four unique roles', () => {
      const group = [
        makePlayer({
          preferences: {
            primaryRole: 'IGL',
            secondaryRole: 'Support',
            micEnabled: true,
          },
        }),
        makePlayer({
          preferences: {
            primaryRole: 'Entry',
            secondaryRole: 'Support',
            micEnabled: true,
          },
        }),
        makePlayer({
          preferences: {
            primaryRole: 'AWPer',
            secondaryRole: 'Support',
            micEnabled: true,
          },
        }),
        makePlayer({
          preferences: {
            primaryRole: 'Lurker',
            secondaryRole: 'Support',
            micEnabled: true,
          },
        }),
        makePlayer({
          preferences: {
            primaryRole: 'Lurker',
            secondaryRole: 'IGL',
            micEnabled: true,
          },
        }),
      ];

      expect(computeRoleSynergyMultiplier(group)).toBeCloseTo(1.05, 5);
    });

    it('awards no multiplier for three or fewer unique roles', () => {
      const group = playersWith({
        preferences: {
          primaryRole: 'IGL',
          secondaryRole: 'Support',
          micEnabled: true,
        },
      });

      expect(computeRoleSynergyMultiplier(group)).toBe(1);
    });
  });
});

describe('strategy implementations', () => {
  beforeEach(() => {
    userCounter = 0;
  });

  it('returns a perfect score for an ideal competitive group', () => {
    const group = [
      makePlayer({
        preferences: {
          primaryRole: 'IGL',
          secondaryRole: 'Support',
          micEnabled: true,
        },
      }),
      makePlayer({
        preferences: {
          primaryRole: 'Entry',
          secondaryRole: 'Support',
          micEnabled: true,
        },
      }),
      makePlayer({
        preferences: {
          primaryRole: 'AWPer',
          secondaryRole: 'Support',
          micEnabled: true,
        },
      }),
      makePlayer({
        preferences: {
          primaryRole: 'Lurker',
          secondaryRole: 'Support',
          micEnabled: true,
        },
      }),
      makePlayer({
        preferences: {
          primaryRole: 'Support',
          secondaryRole: 'IGL',
          micEnabled: true,
        },
      }),
    ];

    expect(new CompetitiveScoringStrategy().scoreGroup(group)).toBe(1);
  });

  it('casual strategy always accepts a non-empty group', () => {
    const strategy = new CasualScoringStrategy();
    expect(strategy.scoreGroup([makePlayer()])).toBe(1);
    expect(strategy.scoreGroup([])).toBe(0);
  });
});

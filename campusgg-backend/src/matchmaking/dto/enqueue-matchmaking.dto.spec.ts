import 'reflect-metadata';

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { EnqueueMatchmakingDto } from './enqueue-matchmaking.dto.js';

function validPayload() {
  return {
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
  };
}

async function validatePayload(payload: unknown) {
  return validate(plainToInstance(EnqueueMatchmakingDto, payload));
}

describe('EnqueueMatchmakingDto', () => {
  it('accepts a valid payload', async () => {
    const errors = await validatePayload(validPayload());
    expect(errors).toHaveLength(0);
  });

  it.each(['profile', 'stats', 'preferences'] as const)(
    'rejects a missing %s object',
    async (field) => {
      const payload: Record<string, unknown> = { ...validPayload() };
      delete payload[field];

      const errors = await validatePayload(payload);

      expect(errors.some((error) => error.property === field)).toBe(true);
    },
  );

  it('rejects an unsupported game', async () => {
    const errors = await validatePayload({
      ...validPayload(),
      game: 'Not A Real Game',
    });

    expect(errors.some((error) => error.property === 'game')).toBe(true);
  });

  it('rejects an out-of-range intensity', async () => {
    const errors = await validatePayload({
      ...validPayload(),
      intensity: 1.5,
    });

    expect(errors.some((error) => error.property === 'intensity')).toBe(true);
  });

  it('rejects an unsupported university domain', async () => {
    const payload = validPayload();
    payload.profile.universityDomain = 'example.com';

    const errors = await validatePayload(payload);

    expect(errors.some((error) => error.property === 'profile')).toBe(true);
  });

  it('rejects an out-of-range rating', async () => {
    const payload = validPayload();
    payload.stats.rating = -1;

    const errors = await validatePayload(payload);

    expect(errors.some((error) => error.property === 'stats')).toBe(true);
  });

  it('rejects a non-boolean mic flag', async () => {
    const payload = validPayload();
    (payload.preferences as { micEnabled: unknown }).micEnabled = 'yes';

    const errors = await validatePayload(payload);

    expect(errors.some((error) => error.property === 'preferences')).toBe(true);
  });

  it('ignores client-supplied userId and queueTime fields', async () => {
    const errors = await validatePayload({
      ...validPayload(),
      userId: 'usr_spoofed',
      queueTime: 999999,
    });

    expect(errors).toHaveLength(0);
  });
});

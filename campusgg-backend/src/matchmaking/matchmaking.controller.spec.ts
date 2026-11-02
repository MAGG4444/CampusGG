import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';

import type { AuthenticatedRequest } from '../auth/jwt-auth.guard.js';
import { MatchmakingController } from './matchmaking.controller.js';
import type { EnqueueMatchmakingDto } from './dto/enqueue-matchmaking.dto.js';
import type { MatchmakingService } from './matchmaking.service.js';

function validDto(
  overrides: Partial<EnqueueMatchmakingDto> = {},
): EnqueueMatchmakingDto {
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
    ...overrides,
  } as EnqueueMatchmakingDto;
}

function authenticatedRequest(userId = 'usr_from_token'): AuthenticatedRequest {
  return { user: { id: userId } } as AuthenticatedRequest;
}

function setup(nodeEnv = 'test') {
  const service = {
    enqueue: jest.fn().mockResolvedValue(true),
    getMatchStatus: jest
      .fn()
      .mockResolvedValue({ matched: false, queued: false }),
    processQueue: jest.fn().mockResolvedValue(undefined),
    dequeue: jest.fn().mockResolvedValue(true),
  };

  const configService = {
    get: jest.fn((key: string) => (key === 'NODE_ENV' ? nodeEnv : undefined)),
  };

  const controller = new MatchmakingController(
    service as unknown as MatchmakingService,
    configService as unknown as ConfigService,
  );

  return { controller, service };
}

describe('MatchmakingController', () => {
  it('derives the enqueue userId from the authenticated request', async () => {
    const { controller, service } = setup();

    await controller.enqueue(validDto(), authenticatedRequest('usr_token_1'));

    expect(service.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'usr_token_1',
        game: 'CS2',
      }),
    );
  });

  it('derives the match-status userId from the authenticated request', async () => {
    const { controller, service } = setup();

    await controller.getMatchStatus(authenticatedRequest('usr_token_2'));

    expect(service.getMatchStatus).toHaveBeenCalledWith('usr_token_2');
  });

  it('derives the dequeue userId from the authenticated request', async () => {
    const { controller, service } = setup();

    await controller.dequeue(authenticatedRequest('usr_token_3'));

    expect(service.dequeue).toHaveBeenCalledWith('usr_token_3');
  });

  it('rejects a missing authenticated user', async () => {
    const { controller } = setup();

    await expect(
      controller.enqueue(validDto(), {} as AuthenticatedRequest),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects stats whose game does not match the queue game', async () => {
    const { controller } = setup();

    await expect(
      controller.enqueue(
        validDto({ stats: { game: 'Valorant', rating: 15000 } }),
        authenticatedRequest(),
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects a role that does not belong to the selected game', async () => {
    const { controller } = setup();

    await expect(
      controller.enqueue(
        validDto({
          preferences: {
            primaryRole: 'Mid',
            secondaryRole: 'Support',
            micEnabled: true,
          },
        }),
        authenticatedRequest(),
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects non-empty roles for a game without fixed roles', async () => {
    const { controller } = setup();

    await expect(
      controller.enqueue(
        validDto({
          game: 'It Takes Two',
          stats: { game: 'It Takes Two', rating: 0 },
          preferences: {
            primaryRole: 'IGL',
            secondaryRole: '',
            micEnabled: true,
          },
        }),
        authenticatedRequest(),
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('accepts empty roles for a game without fixed roles', async () => {
    const { controller, service } = setup();

    await controller.enqueue(
      validDto({
        game: 'It Takes Two',
        stats: { game: 'It Takes Two', rating: 0 },
        preferences: {
          primaryRole: '',
          secondaryRole: '',
          micEnabled: true,
        },
      }),
      authenticatedRequest(),
    );

    expect(service.enqueue).toHaveBeenCalledTimes(1);
  });

  it('rejects a duplicate queue entry', async () => {
    const { controller, service } = setup();
    service.enqueue.mockResolvedValue(false);

    await expect(
      controller.enqueue(validDto(), authenticatedRequest()),
    ).rejects.toThrow(ConflictException);
  });

  it('delegates processQueue outside production', async () => {
    const { controller, service } = setup('development');

    await controller.processQueue();

    expect(service.processQueue).toHaveBeenCalledTimes(1);
  });

  it('rejects manual ticks in production', async () => {
    const { controller, service } = setup('production');

    await expect(controller.processQueue()).rejects.toThrow(ForbiddenException);
    expect(service.processQueue).not.toHaveBeenCalled();
  });
});

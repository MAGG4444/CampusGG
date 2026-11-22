import { ConflictException } from '@nestjs/common';

import { RecommendationsService } from './recommendations.service';
import type { LobbyCandidate } from './lobby-scorer';

const HOUR = 3_600_000;
const NOW = Date.now();

function makeLobby(id: string, hostId: string): LobbyCandidate {
  return {
    id,
    lobbyName: `Lobby ${id}`,
    subtitle: null,
    details: 'Test lobby',
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
      email: `${hostId}@purdue.edu`,
      gamingProfiles: [],
    },
    memberCount: 2,
  } as unknown as LobbyCandidate;
}

function createService() {
  const usersService = {
    findOne: jest.fn(),
    findRecommendationCandidates: jest.fn(),
  };
  const lobbiesService = {
    findCurrentLobbyId: jest.fn(),
    findRecommendationCandidates: jest.fn(),
    joinLobby: jest.fn(),
  };
  return {
    usersService,
    lobbiesService,
    service: new RecommendationsService(
      lobbiesService as never,
      usersService as never,
    ),
  };
}

const viewer = {
  id: 'viewer',
  email: 'viewer@purdue.edu',
  gamingProfiles: [
    {
      game: 'CS2',
      preferredRoles: ['Support'],
      experienceLevel: 'Intermediate',
    },
  ],
};

describe('RecommendationsService', () => {
  it('returns needsProfile when the viewer has no gaming profile', async () => {
    const { usersService, service } = createService();
    usersService.findOne.mockResolvedValue({
      id: 'viewer',
      email: 'viewer@purdue.edu',
      gamingProfiles: [],
    });

    await expect(service.recommendUsers('viewer')).resolves.toEqual({
      items: [],
      needsProfile: true,
      game: null,
    });
  });

  it('requires a profile for the requested suggested-users game', async () => {
    const { usersService, service } = createService();
    usersService.findOne.mockResolvedValue(viewer);

    await expect(
      service.recommendUsers('viewer', { game: 'Overwatch 2' }),
    ).resolves.toEqual({
      items: [],
      needsProfile: true,
      game: 'Overwatch 2',
    });
    expect(usersService.findRecommendationCandidates).not.toHaveBeenCalled();
  });

  it.each(['Overwatch 2', 'League of Legends', 'Valorant', 'Dota 2'])(
    'requires a profile for %s lobby recommendations',
    async (game) => {
      const { usersService, lobbiesService, service } = createService();
      usersService.findOne.mockResolvedValue(viewer);
      lobbiesService.findCurrentLobbyId.mockResolvedValue(null);

      await expect(
        service.recommendLobbies('viewer', { game }),
      ).resolves.toEqual({
        items: [],
        needsProfile: true,
        game,
      });
      expect(
        lobbiesService.findRecommendationCandidates,
      ).not.toHaveBeenCalled();
    },
  );

  it('returns canonical game metadata for lobby recommendations', async () => {
    const { usersService, lobbiesService, service } = createService();
    usersService.findOne.mockResolvedValue(viewer);
    lobbiesService.findCurrentLobbyId.mockResolvedValue(null);
    lobbiesService.findRecommendationCandidates.mockResolvedValue([
      makeLobby('lobby-a', 'host-a'),
    ]);

    const result = await service.recommendLobbies('viewer', { game: 'csgo' });

    expect(result).toMatchObject({
      needsProfile: false,
      game: 'CS2',
    });
    expect(result.items).toHaveLength(1);
  });

  it('never exposes candidate email in suggested users', async () => {
    const { usersService, service } = createService();
    usersService.findOne.mockResolvedValue(viewer);
    usersService.findRecommendationCandidates.mockResolvedValue([
      {
        id: 'candidate',
        username: 'alex',
        displayName: 'Alex',
        bio: 'Support main',
        email: 'alex@purdue.edu',
        gamingProfiles: [
          {
            game: 'CS2',
            preferredRoles: ['Support'],
            experienceLevel: 'Intermediate',
          },
        ],
      },
    ]);

    const result = await service.recommendUsers('viewer');

    expect(result.items).toHaveLength(1);
    expect(result.items[0].user).not.toHaveProperty('email');
    expect(result.items[0].user.campusDomain).toBe('purdue.edu');
  });

  it('returns the current lobby without scoring', async () => {
    const { usersService, lobbiesService, service } = createService();
    usersService.findOne.mockResolvedValue(viewer);
    lobbiesService.findCurrentLobbyId.mockResolvedValue('current-lobby');

    await expect(service.quickJoin('viewer', { game: 'CS2' })).resolves.toEqual(
      {
        lobbyId: 'current-lobby',
        joined: true,
        alreadyMember: true,
        reasons: [],
      },
    );
    expect(lobbiesService.joinLobby).not.toHaveBeenCalled();
  });

  it('tries the next recommendation when a lobby is already full', async () => {
    const { usersService, lobbiesService, service } = createService();
    usersService.findOne.mockResolvedValue(viewer);
    lobbiesService.findCurrentLobbyId.mockResolvedValue(null);
    lobbiesService.findRecommendationCandidates.mockResolvedValue([
      makeLobby('lobby-a', 'host-a'),
      makeLobby('lobby-b', 'host-b'),
    ]);
    lobbiesService.joinLobby
      .mockRejectedValueOnce(new ConflictException('Lobby is full'))
      .mockResolvedValueOnce(undefined);

    const result = await service.quickJoin('viewer', { game: 'CS2' });

    expect(result).toMatchObject({ lobbyId: 'lobby-b', joined: true });
    expect(lobbiesService.joinLobby).toHaveBeenNthCalledWith(
      1,
      'lobby-a',
      'viewer',
    );
    expect(lobbiesService.joinLobby).toHaveBeenNthCalledWith(
      2,
      'lobby-b',
      'viewer',
    );
  });

  it('falls back to create-lobby with a canonical game and needed roles', async () => {
    const { usersService, lobbiesService, service } = createService();
    usersService.findOne.mockResolvedValue(viewer);
    lobbiesService.findCurrentLobbyId.mockResolvedValue(null);
    lobbiesService.findRecommendationCandidates.mockResolvedValue([
      makeLobby('lobby-a', 'host-a'),
    ]);
    lobbiesService.joinLobby.mockRejectedValue(
      new ConflictException('Lobby is full'),
    );

    await expect(
      service.quickJoin('viewer', { game: 'csgo' }),
    ).resolves.toEqual({
      fallback: 'create-lobby',
      prefill: { game: 'CS2', neededRoles: ['Support'] },
    });
  });

  it('falls back when the requested game is not on the profile', async () => {
    const { usersService, lobbiesService, service } = createService();
    usersService.findOne.mockResolvedValue(viewer);
    lobbiesService.findCurrentLobbyId.mockResolvedValue(null);

    await expect(
      service.quickJoin('viewer', { game: 'overwatch' }),
    ).resolves.toEqual({
      fallback: 'create-lobby',
      prefill: { game: 'Overwatch 2', neededRoles: [] },
    });
    expect(lobbiesService.findRecommendationCandidates).not.toHaveBeenCalled();
  });
});

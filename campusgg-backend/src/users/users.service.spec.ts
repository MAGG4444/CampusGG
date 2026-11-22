import { Repository } from 'typeorm';
import { UsersService } from './users.service';
import { User } from './user.entity';
import { MAX_RECOMMENDATION_CANDIDATES } from '../recommendations/recommendation.config';

describe('UsersService profile updates', () => {
  const update = jest.fn();
  const findOne = jest.fn();
  const service = new UsersService({
    update,
    findOne,
  } as unknown as Repository<User>);

  beforeEach(() => jest.resetAllMocks());

  it('updates only supplied fields for the JWT user', async () => {
    findOne
      .mockResolvedValueOnce({ id: 'alice', gamingProfiles: [] })
      .mockResolvedValueOnce({ id: 'alice', bio: 'New bio' });
    update.mockResolvedValue({ affected: 1 });

    await service.updateProfile('alice', { bio: ' New bio ' });

    expect(update).toHaveBeenCalledWith('alice', { bio: 'New bio' });
  });

  it('persists multiple roles and experience independently by game', async () => {
    findOne
      .mockResolvedValueOnce({ id: 'alice', gamingProfiles: [] })
      .mockResolvedValueOnce({ id: 'alice' });
    update.mockResolvedValue({ affected: 1 });

    await service.updateProfile('alice', {
      gamingProfiles: [
        {
          game: 'valorant',
          preferredRoles: ['controller', 'Sentinel'],
          experienceLevel: 'Intermediate',
        },
        {
          game: 'Minecraft',
          preferredRoles: ['Strategist'],
          experienceLevel: 'Advanced',
        },
      ],
    });

    expect(update).toHaveBeenCalledWith('alice', {
      gamingProfiles: [
        {
          game: 'Valorant',
          preferredRoles: ['Controller', 'Sentinel'],
          experienceLevel: 'Intermediate',
        },
        {
          game: 'Minecraft',
          preferredRoles: ['Strategist'],
          experienceLevel: 'Advanced',
        },
      ],
    });
  });

  it('accepts no roles and rejects roles outside the game list', async () => {
    findOne.mockResolvedValue({ id: 'alice', gamingProfiles: [] });
    update.mockResolvedValue({ affected: 1 });

    await expect(
      service.updateProfile('alice', {
        gamingProfiles: [
          {
            game: 'Overwatch 2',
            preferredRoles: [],
            experienceLevel: 'Beginner',
          },
        ],
      }),
    ).resolves.toBeDefined();

    await expect(
      service.updateProfile('alice', {
        gamingProfiles: [
          {
            game: 'Valorant',
            preferredRoles: ['Support'],
            experienceLevel: 'Beginner',
          },
        ],
      }),
    ).rejects.toThrow('Invalid preferred role for Valorant');
  });

  it('does not write an empty partial update', async () => {
    findOne.mockResolvedValue({ id: 'alice' });
    await service.updateProfile('alice', {});
    expect(update).not.toHaveBeenCalled();
  });
});

describe('UsersService recommendation candidates', () => {
  function setup() {
    const query = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };
    const repository = {
      createQueryBuilder: jest.fn(() => query),
    } as unknown as Repository<User>;
    return {
      query,
      service: new UsersService(repository),
    };
  }

  it('filters by game in SQL before limiting candidates', async () => {
    const { service, query } = setup();

    await service.findRecommendationCandidates('viewer', 'valorant');

    expect(query.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('jsonb_array_elements(user.gaming_profiles)'),
      { gameKeys: ['valorant', 'val'] },
    );
    expect(query.take).toHaveBeenCalledWith(MAX_RECOMMENDATION_CANDIDATES);
  });

  it('requires at least one gaming profile when no game is requested', async () => {
    const { service, query } = setup();

    await service.findRecommendationCandidates('viewer');

    expect(query.andWhere).toHaveBeenCalledWith(
      'jsonb_array_length(user.gaming_profiles) > 0',
    );
  });

  it('excludes the viewer and requires edu verification', async () => {
    const { service, query } = setup();

    await service.findRecommendationCandidates('viewer', 'lol');

    expect(query.where).toHaveBeenCalledWith(
      'user.eduVerified = :eduVerified',
      { eduVerified: true },
    );
    expect(query.andWhere).toHaveBeenCalledWith('user.id != :viewerId', {
      viewerId: 'viewer',
    });
  });
});

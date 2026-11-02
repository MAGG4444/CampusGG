import { Repository } from 'typeorm';
import { UsersService } from './users.service';
import { User } from './user.entity';

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

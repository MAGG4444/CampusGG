import { Repository } from 'typeorm';
import { ConflictException } from '@nestjs/common';

import { LobbiesService } from './lobbies.service';
import { Lobby } from './lobby.entity';
import { UsersService } from '../users/users.service';

describe('LobbiesService', () => {
  function setup() {
    const find = jest.fn(() => Promise.resolve([] as Lobby[]));

    const repository = {
      find,
    } as unknown as Repository<Lobby>;

    const usersService = {
      findOne: jest.fn(),
    } as unknown as UsersService;

    const service = new LobbiesService(repository, usersService);

    return { service, find };
  }

  it('should retrieve all lobbies without filters', async () => {
    const { service, find } = setup();

    const result = await service.findAll();

    expect(find).toHaveBeenCalledWith({
      where: {},
      order: { createdAt: 'DESC' },
    });

    expect(result).toEqual([]);
  });

  it('rejects creation when the host already belongs to a lobby', async () => {
    const manager = {
      findOneOrFail: jest.fn().mockResolvedValue({ id: 'user' }),
      findOne: jest.fn().mockResolvedValue({ id: 'membership' }),
      create: jest.fn(),
      transaction: jest.fn(),
    };
    manager.transaction.mockImplementation(
      (work: (value: unknown) => unknown) => work(manager),
    );
    const service = new LobbiesService(
      { manager } as unknown as Repository<Lobby>,
      {
        findOne: jest.fn().mockResolvedValue({ id: 'user' }),
      } as unknown as UsersService,
    );
    await expect(
      service.create({ lobbyName: 'Test', details: 'Test' }, 'user'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(manager.create).not.toHaveBeenCalled();
  });

  it('should filter lobbies by game and skill level', async () => {
    const { service, find } = setup();

    await service.findAll({
      game: 'Valorant',
      skillLevel: 'Beginner',
    });

    expect(find).toHaveBeenCalledWith({
      where: {
        game: 'Valorant',
        skillLevel: 'Beginner',
      },
      order: { createdAt: 'DESC' },
    });
  });

  it('should filter lobbies by game only', async () => {
    const { service, find } = setup();

    await service.findAll({
      game: 'Valorant',
    });

    expect(find).toHaveBeenCalledWith({
      where: {
        game: 'Valorant',
      },
      order: { createdAt: 'DESC' },
    });
  });
});

import { FindManyOptions, Repository } from 'typeorm';
import { ConflictException } from '@nestjs/common';

import { LobbiesService } from './lobbies.service';
import { Lobby } from './lobby.entity';
import { UsersService } from '../users/users.service';
import { LobbyMember, LobbyMemberRole } from './lobby-member.entity';

describe('LobbiesService', () => {
  it('returns the authenticated user’s lobby roles without exposing user or lobby data', async () => {
    const find = jest.fn().mockResolvedValue([
      {
        lobby: { id: 'lobby', details: 'private' },
        role: LobbyMemberRole.HOST,
        user: { email: 'private' },
      },
    ]);
    const service = new LobbiesService(
      { manager: { find } } as unknown as Repository<Lobby>,
      {} as UsersService,
    );
    await expect(service.findMyMemberships('user')).resolves.toEqual([
      { lobbyId: 'lobby', role: 'host' },
    ]);
    expect(find).toHaveBeenCalledWith(LobbyMember, {
      where: { user: { id: 'user' } },
      relations: { lobby: true },
    });
  });
  function setup() {
    const find = jest
      .fn<Promise<Lobby[]>, [FindManyOptions<Lobby>]>()
      .mockResolvedValue([]);

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

    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {},
        order: { createdAt: 'DESC' },
        relations: { host: true },
      }),
    );
    expect(find.mock.calls[0][0].select).toMatchObject({
      host: { id: true, username: true },
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

    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { game: 'Valorant', skillLevel: 'Beginner' },
        order: { createdAt: 'DESC' },
      }),
    );
  });

  it('should filter lobbies by game only', async () => {
    const { service, find } = setup();

    await service.findAll({
      game: 'Valorant',
    });

    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { game: 'Valorant' },
        order: { createdAt: 'DESC' },
      }),
    );
  });
});

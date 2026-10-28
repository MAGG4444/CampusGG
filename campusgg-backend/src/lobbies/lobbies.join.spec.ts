import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { EntityManager, Repository } from 'typeorm';

import { LobbiesService } from './lobbies.service';
import { Lobby, LobbyVisibility } from './lobby.entity';
import { LobbyMember, LobbyMemberRole } from './lobby-member.entity';
import { UsersService } from '../users/users.service';
import { User } from '../users/user.entity';

describe('LobbiesService - Join Lobby', () => {
  const lobbyId = '11111111-1111-4111-8111-111111111111';
  const userId = '22222222-2222-4222-8222-222222222222';

  const defaultLobby = {
    id: lobbyId,
    visibility: LobbyVisibility.PUBLIC,
    participantLimit: 3,
  } as Lobby;

  const testUser = { id: userId } as User;

  function setup(
    options: {
      lobby?: Lobby | null;
      membership?: LobbyMember | null;
      memberCount?: number;
    } = {},
  ) {
    const lobby = options.lobby === undefined ? defaultLobby : options.lobby;

    const membership = options.membership ?? null;
    const memberCount = options.memberCount ?? 1;

    const findOne = jest.fn().mockImplementation((entity: unknown) => {
      if (entity === Lobby) {
        return Promise.resolve(lobby);
      }

      if (entity === LobbyMember) {
        return Promise.resolve(membership);
      }

      return Promise.resolve(null);
    });

    const count = jest.fn().mockResolvedValue(memberCount);

    const create = jest.fn().mockReturnValue({
      role: LobbyMemberRole.MEMBER,
    });

    const save = jest.fn().mockResolvedValue(undefined);

    const manager = {
      findOne,
      count,
      create,
      save,
    } as unknown as EntityManager;

    const transaction = jest.fn(
      (work: (manager: EntityManager) => Promise<void>) => work(manager),
    );

    const repository = {
      manager: { transaction },
    } as unknown as Repository<Lobby>;

    const findUser = jest.fn().mockResolvedValue(testUser);

    const usersService = {
      findOne: findUser,
    } as unknown as UsersService;

    const service = new LobbiesService(repository, usersService);

    return {
      service,
      findOne,
      count,
      create,
      save,
      findUser,
      lobby,
    };
  }

  it('allows a user to join an available public lobby', async () => {
    const { service, findOne, count, create, save, lobby } = setup();

    await service.joinLobby(lobbyId, userId);

    expect(findOne).toHaveBeenNthCalledWith(1, Lobby, {
      where: { id: lobbyId },
      lock: { mode: 'pessimistic_write' },
    });

    expect(count).toHaveBeenCalledWith(LobbyMember, {
      where: { lobby: { id: lobbyId } },
    });

    expect(create).toHaveBeenCalledWith(LobbyMember, {
      lobby,
      user: testUser,
      role: LobbyMemberRole.MEMBER,
    });

    expect(save).toHaveBeenCalledTimes(1);
  });

  it('rejects duplicate membership', async () => {
    const existingMembership = {
      role: LobbyMemberRole.MEMBER,
    } as LobbyMember;

    const { service, save } = setup({
      membership: existingMembership,
    });

    await expect(service.joinLobby(lobbyId, userId)).rejects.toBeInstanceOf(
      ConflictException,
    );

    expect(save).not.toHaveBeenCalled();
  });

  it('rejects joining a full lobby', async () => {
    const { service, save } = setup({
      memberCount: 3,
    });

    await expect(service.joinLobby(lobbyId, userId)).rejects.toBeInstanceOf(
      ConflictException,
    );

    expect(save).not.toHaveBeenCalled();
  });

  it('rejects joining a private lobby', async () => {
    const privateLobby = {
      ...defaultLobby,
      visibility: LobbyVisibility.PRIVATE,
    } as Lobby;

    const { service, save } = setup({
      lobby: privateLobby,
    });

    await expect(service.joinLobby(lobbyId, userId)).rejects.toBeInstanceOf(
      ForbiddenException,
    );

    expect(save).not.toHaveBeenCalled();
  });

  it('rejects joining a nonexistent lobby', async () => {
    const { service, save } = setup({
      lobby: null,
    });

    await expect(service.joinLobby(lobbyId, userId)).rejects.toBeInstanceOf(
      NotFoundException,
    );

    expect(save).not.toHaveBeenCalled();
  });
});

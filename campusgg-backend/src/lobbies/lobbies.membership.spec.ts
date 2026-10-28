import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { EntityManager, Repository } from 'typeorm';

import { LobbiesService } from './lobbies.service';
import { Lobby } from './lobby.entity';
import { LobbyMember, LobbyMemberRole } from './lobby-member.entity';
import { UsersService } from '../users/users.service';

describe('LobbiesService Membership', () => {
  const lobbyId = '11111111-1111-4111-8111-111111111111';
  const userId = '22222222-2222-4222-8222-222222222222';

  function setup(lobby: Lobby | null, membership: LobbyMember | null) {
    const findOne = jest
      .fn()
      .mockResolvedValueOnce(lobby)
      .mockResolvedValueOnce(membership);

    const remove = jest.fn().mockResolvedValue(undefined);

    const manager = {
      findOne,
      remove,
    } as unknown as EntityManager;

    const transaction = jest.fn(
      (work: (manager: EntityManager) => Promise<void>) => work(manager),
    );

    const repository = {
      manager: { transaction },
    } as unknown as Repository<Lobby>;

    const service = new LobbiesService(repository, {} as UsersService);

    return { service, findOne, remove };
  }

  it('allows a regular member to leave', async () => {
    const membership = {
      role: LobbyMemberRole.MEMBER,
    } as LobbyMember;

    const { service, remove, findOne } = setup(
      { id: lobbyId } as Lobby,
      membership,
    );

    await service.leaveLobby(lobbyId, userId);

    expect(remove).toHaveBeenCalledWith(LobbyMember, membership);

    expect(findOne).toHaveBeenNthCalledWith(1, Lobby, {
      where: { id: lobbyId },
      lock: { mode: 'pessimistic_write' },
    });
  });

  it('rejects leaving a nonexistent lobby', async () => {
    const { service, remove } = setup(null, null);

    await expect(service.leaveLobby(lobbyId, userId)).rejects.toBeInstanceOf(
      NotFoundException,
    );

    expect(remove).not.toHaveBeenCalled();
  });

  it('rejects a user who is not a member', async () => {
    const { service, remove } = setup({ id: lobbyId } as Lobby, null);

    await expect(service.leaveLobby(lobbyId, userId)).rejects.toBeInstanceOf(
      NotFoundException,
    );

    expect(remove).not.toHaveBeenCalled();
  });

  it('prevents the host from leaving', async () => {
    const membership = {
      role: LobbyMemberRole.HOST,
    } as LobbyMember;

    const { service, remove } = setup({ id: lobbyId } as Lobby, membership);

    await expect(service.leaveLobby(lobbyId, userId)).rejects.toBeInstanceOf(
      ForbiddenException,
    );

    expect(remove).not.toHaveBeenCalled();
  });
});

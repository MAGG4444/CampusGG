import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { EntityManager, Repository } from 'typeorm';

import { LobbiesService } from './lobbies.service';
import { Lobby } from './lobby.entity';
import { LobbyMember, LobbyMemberRole } from './lobby-member.entity';
import { UsersService } from '../users/users.service';

describe('LobbiesService Membership', () => {
  const lobbyId = '11111111-1111-4111-8111-111111111111';
  const userId = '22222222-2222-4222-8222-222222222222';

  function setup(
    lobby: Lobby | null,
    membership: LobbyMember | null,
    next: LobbyMember | null = null,
  ) {
    const findOne = jest
      .fn()
      .mockResolvedValueOnce(lobby)
      .mockResolvedValueOnce(membership)
      .mockResolvedValueOnce(next);

    const remove = jest.fn().mockResolvedValue(undefined);
    const save = jest.fn().mockResolvedValue(undefined);

    const manager = {
      findOne,
      remove,
      save,
    } as unknown as EntityManager;

    const transaction = jest.fn(
      (work: (manager: EntityManager) => Promise<void>) => work(manager),
    );

    const repository = {
      manager: { transaction },
    } as unknown as Repository<Lobby>;

    const service = new LobbiesService(repository, {} as UsersService);

    return { service, findOne, remove, save };
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

  it('closes the lobby when its last host leaves', async () => {
    const membership = {
      role: LobbyMemberRole.HOST,
    } as LobbyMember;

    const lobby = { id: lobbyId } as Lobby;
    const { service, remove } = setup(lobby, membership);
    await service.leaveLobby(lobbyId, userId);
    expect(remove).toHaveBeenCalledWith(Lobby, lobby);
  });

  it('transfers the host role to the earliest member before removing the host', async () => {
    const lobby = { id: lobbyId } as Lobby;
    const host = { role: LobbyMemberRole.HOST } as LobbyMember;
    const next = {
      role: LobbyMemberRole.MEMBER,
      user: { id: 'next' },
    } as LobbyMember;
    const { service, findOne, save, remove } = setup(lobby, host, next);
    await service.leaveLobby(lobbyId, userId);
    expect(findOne).toHaveBeenNthCalledWith(
      3,
      LobbyMember,
      expect.objectContaining({ order: { joinedAt: 'ASC', id: 'ASC' } }),
    );
    expect(next.role).toBe(LobbyMemberRole.HOST);
    expect(lobby.host).toBe(next.user);
    expect(save).toHaveBeenCalledWith(LobbyMember, next);
    expect(save).toHaveBeenCalledWith(Lobby, lobby);
    expect(remove).toHaveBeenCalledWith(LobbyMember, host);
  });

  it('rejects deletion by a non-host', async () => {
    const { service, remove } = setup({ id: lobbyId } as Lobby, null);
    await expect(service.deleteLobby(lobbyId, userId)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(remove).not.toHaveBeenCalled();
  });

  it('allows the current host to delete', async () => {
    const lobby = { id: lobbyId } as Lobby;
    const { service, remove } = setup(lobby, {
      role: LobbyMemberRole.HOST,
    } as LobbyMember);
    await service.deleteLobby(lobbyId, userId);
    expect(remove).toHaveBeenCalledWith(Lobby, lobby);
  });
});

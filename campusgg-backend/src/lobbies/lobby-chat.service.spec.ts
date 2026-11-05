import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { validate } from 'class-validator';
import { Repository } from 'typeorm';
import { LobbyChatService } from './lobby-chat.service';
import { Lobby } from './lobby.entity';
import { LobbyMessage } from './lobby-message.entity';
import { CreateLobbyMessageDto } from './dto/create-lobby-message.dto';

describe('LobbyChatService', () => {
  const manager = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    findOneOrFail: jest.fn(),
    transaction: jest.fn(),
    query: jest.fn(),
    connection: {
      options: { schema: 'public' },
      driver: { escape: (value: string) => `"${value}"` },
    },
  };
  const service = new LobbyChatService({
    manager,
  } as unknown as Repository<Lobby>);

  beforeEach(() => {
    jest.resetAllMocks();
    manager.transaction.mockImplementation(
      (fn: (manager: unknown) => unknown) => fn(manager),
    );
    manager.findOne
      .mockResolvedValueOnce({ id: 'lobby-a' })
      .mockResolvedValueOnce({ id: 'membership' });
  });

  it('sends as the authenticated member within the specified lobby', async () => {
    manager.create.mockImplementation(
      (_entity: unknown, value: unknown) => value,
    );
    manager.save.mockResolvedValue({ id: 'message-a' });
    manager.findOneOrFail.mockResolvedValue({
      id: 'message-a',
      content: 'hello',
      createdAt: new Date(),
      sender: { id: 'user-a', username: 'alice' },
    });
    const result = await service.send('lobby-a', 'user-a', ' hello ');
    expect(manager.create).toHaveBeenCalledWith(LobbyMessage, {
      lobby: { id: 'lobby-a' },
      sender: { id: 'user-a' },
      content: 'hello',
    });
    expect(result.sender.id).toBe('user-a');
    expect(manager.findOne).toHaveBeenCalledWith(expect.anything(), {
      where: { lobby: { id: 'lobby-a' }, user: { id: 'user-a' } },
    });
  });

  it('rejects non-members on reads and writes before accessing messages', async () => {
    manager.findOne
      .mockReset()
      .mockResolvedValueOnce({ id: 'lobby-a' })
      .mockResolvedValueOnce(null);
    await expect(service.list('lobby-a', 'outsider')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(manager.find).not.toHaveBeenCalled();
    manager.findOne
      .mockReset()
      .mockResolvedValueOnce({ id: 'lobby-a' })
      .mockResolvedValueOnce(null);
    await expect(
      service.send('lobby-a', 'outsider', 'hello'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('rejects read-state access for a non-member', async () => {
    manager.findOne
      .mockReset()
      .mockResolvedValueOnce({ id: 'lobby-a' })
      .mockResolvedValueOnce(null);
    await expect(
      service.readState('lobby-a', 'outsider'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(manager.query).not.toHaveBeenCalled();
    manager.findOne
      .mockReset()
      .mockResolvedValueOnce({ id: 'lobby-a' })
      .mockResolvedValueOnce(null);
    await expect(
      service.markRead('lobby-a', 'outsider', 'message-a'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(manager.query).not.toHaveBeenCalled();
  });

  it('rejects a read cursor for a message outside the lobby', async () => {
    manager.findOne.mockResolvedValueOnce(null);
    await expect(
      service.markRead('lobby-a', 'user-a', 'other-message'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(manager.query).not.toHaveBeenCalled();
  });

  it('queries unread IDs for the current member and excludes their own messages', async () => {
    manager.findOneOrFail.mockResolvedValue({ id: 'member-a' });
    manager.query.mockResolvedValue([{ id: 'one' }, { id: 'two' }]);
    await expect(service.readState('lobby-a', 'user-a')).resolves.toEqual({
      unreadMessageIds: ['one', 'two'],
    });
    expect(manager.query).toHaveBeenCalledWith(
      expect.stringContaining('message.sender_id != $2'),
      ['lobby-a', 'user-a', 'member-a'],
    );
  });

  it('uses a monotonic cursor scoped to the member and lobby', async () => {
    manager.findOne.mockResolvedValueOnce({ id: 'message-a' });
    manager.query.mockResolvedValue([]);
    await service.markRead('lobby-a', 'user-a', 'message-a');
    expect(manager.findOne).toHaveBeenCalledWith(LobbyMessage, {
      where: { id: 'message-a', lobby: { id: 'lobby-a' } },
    });
    expect(manager.query).toHaveBeenCalledWith(
      expect.stringContaining('member.lobby_id = $2 AND member.user_id = $3'),
      ['message-a', 'lobby-a', 'user-a'],
    );
    expect(manager.query).toHaveBeenCalledWith(
      expect.stringContaining('> ROW('),
      ['message-a', 'lobby-a', 'user-a'],
    );
  });

  it('isolates retrieval by lobby and orders chronologically with a stable tie-breaker', async () => {
    manager.find.mockResolvedValue([]);
    await service.list('lobby-a', 'user-a');
    expect(manager.find).toHaveBeenCalledWith(
      LobbyMessage,
      expect.objectContaining({
        where: { lobby: { id: 'lobby-a' } },
        order: { createdAt: 'ASC', id: 'ASC' },
      }),
    );
  });

  it('rejects missing lobbies', async () => {
    manager.findOne.mockReset().mockResolvedValueOnce(null);
    await expect(service.list('missing', 'user-a')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('rejects blank and oversized message content', async () => {
    for (const content of ['', '   ', 'x'.repeat(2001)]) {
      const dto = Object.assign(new CreateLobbyMessageDto(), { content });
      expect((await validate(dto)).length).toBeGreaterThan(0);
    }
    expect(
      await validate(
        Object.assign(new CreateLobbyMessageDto(), { content: 'hello' }),
      ),
    ).toHaveLength(0);
  });
});

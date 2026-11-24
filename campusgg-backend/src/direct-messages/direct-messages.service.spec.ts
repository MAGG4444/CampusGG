import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { DataSource } from 'typeorm';
import { Connection } from '../connections/connection.entity';
import { User } from '../users/user.entity';
import { DirectMessage } from './direct-message.entity';
import { DirectMessagesService } from './direct-messages.service';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const ID = '33333333-3333-4333-8333-333333333333';
const pair = `${A}:${B}`;
const message = {
  id: ID,
  senderId: A,
  recipientId: B,
  pairKey: pair,
  content: 'Hello',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  readAt: null,
};

function fixture() {
  const users = {
    findOneBy: jest
      .fn()
      .mockResolvedValueOnce({ id: A })
      .mockResolvedValueOnce({ id: B }),
  };
  const connections = {
    findOne: jest.fn().mockResolvedValue({ status: 'accepted' }),
  };
  const qb = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue([message]),
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue({ affected: 1 }),
    subQuery: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    getQuery: jest
      .fn()
      .mockReturnValue('(SELECT created_at, id FROM direct_messages)'),
  };
  const messages = {
    create: jest.fn().mockReturnValue(message),
    save: jest.fn().mockResolvedValue(message),
    createQueryBuilder: jest.fn().mockReturnValue(qb),
    findOneBy: jest.fn().mockResolvedValue(message),
  };
  const manager = {
    getRepository: jest.fn((entity: unknown) =>
      entity === User
        ? users
        : entity === Connection
          ? connections
          : entity === DirectMessage
            ? messages
            : undefined,
    ),
    query: jest.fn().mockResolvedValue([]),
  };
  const ds = {
    transaction: jest.fn((fn: (m: typeof manager) => unknown) => fn(manager)),
    driver: { escape: (name: string) => `"${name}"` },
    options: {},
  };
  return {
    service: new DirectMessagesService(ds as unknown as DataSource),
    users,
    connections,
    messages,
    manager,
    qb,
  };
}

describe('DirectMessagesService', () => {
  it('saves only the authenticated sender, recipient and trimmed content', async () => {
    const f = fixture();
    const result = await f.service.send(A, B, '  Hello  ');
    expect(f.connections.findOne).toHaveBeenCalledWith({
      where: { pairKey: pair, status: 'accepted' },
      lock: { mode: 'pessimistic_read' },
    });
    expect(f.messages.create).toHaveBeenCalledWith({
      senderId: A,
      recipientId: B,
      pairKey: pair,
      content: 'Hello',
      readAt: null,
    });
    expect(result).toEqual({
      id: ID,
      senderId: A,
      recipientId: B,
      content: 'Hello',
      createdAt: message.createdAt,
      readAt: null,
    });
  });
  it('rejects blank and oversized messages', async () => {
    const f = fixture();
    await expect(f.service.send(A, B, '  ')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(f.service.send(A, B, 'x'.repeat(2001))).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(f.messages.save).not.toHaveBeenCalled();
  });
  it('rejects a non-verified viewer', async () => {
    const f = fixture();
    f.users.findOneBy.mockReset().mockResolvedValue(null);
    await expect(f.service.send(A, B, 'Hello')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(f.messages.save).not.toHaveBeenCalled();
  });
  it('rejects self messaging', async () => {
    const f = fixture();
    await expect(f.service.send(A, A, 'Hello')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
  it('rejects nonfriends before accessing messages', async () => {
    const f = fixture();
    f.connections.findOne.mockResolvedValue(null);
    await expect(f.service.history(A, B)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(f.messages.createQueryBuilder).not.toHaveBeenCalled();
  });
  it('rejects an unverified recipient', async () => {
    const f = fixture();
    f.users.findOneBy
      .mockReset()
      .mockResolvedValueOnce({ id: A })
      .mockResolvedValueOnce(null);
    await expect(f.service.send(A, B, 'Hello')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
  it('returns an ordered page with a continuation cursor', async () => {
    const f = fixture();
    f.qb.getMany.mockResolvedValue([message, { ...message, id: B }]);
    const response = await f.service.history(A, B, 1);
    expect(f.qb.where).toHaveBeenCalledWith('m.pair_key = :pair', { pair });
    expect(f.qb.take).toHaveBeenCalledWith(2);
    expect(response.nextBefore).toBe(ID);
    expect(response.items).toHaveLength(1);
  });
  it('rejects a cursor from another conversation', async () => {
    const f = fixture();
    f.messages.findOneBy.mockResolvedValue(null);
    await expect(f.service.history(A, B, 50, ID)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(f.messages.findOneBy).toHaveBeenCalledWith({
      id: ID,
      pairKey: pair,
    });
  });
  it('marks only the selected received messages as read', async () => {
    const f = fixture();
    expect(await f.service.markRead(A, B, [ID, ID])).toEqual({ updated: 1 });
    expect(f.qb.where).toHaveBeenCalledWith(
      'pair_key = :pair AND recipient_id = :viewerId AND sender_id = :targetId AND read_at IS NULL',
      { pair, viewerId: A, targetId: B },
    );
    expect(f.qb.andWhere).toHaveBeenCalledWith('id IN (:...messageIds)', {
      messageIds: [ID],
    });
  });
  it('lists conversations with a public profile allowlist', async () => {
    const f = fixture();
    f.manager.query.mockResolvedValue([
      {
        id: B,
        username: 'friend',
        displayName: 'Friend',
        bio: '',
        messageId: ID,
        senderId: A,
        recipientId: B,
        content: 'Hello',
        createdAt: message.createdAt,
        readAt: null,
        unreadCount: 0,
        email: 'private',
      },
    ]);
    const response = await f.service.list(A);
    expect(response.items[0].user).toEqual({
      id: B,
      username: 'friend',
      displayName: 'Friend',
      bio: '',
    });
    expect(response.items[0].unreadCount).toBe(0);
  });
});

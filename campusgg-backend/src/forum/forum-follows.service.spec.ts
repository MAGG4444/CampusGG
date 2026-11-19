import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { ForumChannel } from './forum-channel.entity';
import { ForumChannelFollow } from './forum-channel-follow.entity';
import { ForumFollowsService } from './forum-follows.service';
import { ForumService } from './forum.service';

describe('ForumFollowsService', () => {
  const channel = {
    id: 'cs2',
    slug: 'cs2',
    name: 'CS2',
    aliases: ['cs2', 'counter-strike 2'],
  };
  const follows = {
    find: jest.fn(),
    existsBy: jest.fn(),
    delete: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  const channels = { findOneBy: jest.fn() };
  const users = { findOneBy: jest.fn() };
  const forum = { findChannelPosts: jest.fn() };
  const service = new ForumFollowsService(
    follows as unknown as Repository<ForumChannelFollow>,
    channels as unknown as Repository<ForumChannel>,
    users as unknown as Repository<User>,
    forum as unknown as ForumService,
  );
  beforeEach(() => jest.resetAllMocks());
  it('rejects unknown channels and unverified accounts', async () => {
    channels.findOneBy.mockResolvedValue(null);
    await expect(service.set('u', 'bad', true)).rejects.toThrow(
      NotFoundException,
    );
    channels.findOneBy.mockResolvedValue(channel);
    users.findOneBy.mockResolvedValue(null);
    await expect(service.set('u', 'cs2', true)).rejects.toThrow(
      ForbiddenException,
    );
  });
  it('uses scoped idempotent deletion and returns actual status', async () => {
    channels.findOneBy.mockResolvedValue(channel);
    users.findOneBy.mockResolvedValue({ id: 'u' });
    follows.existsBy.mockResolvedValue(false);
    await expect(service.set('u', 'cs2', false)).resolves.toEqual({
      following: false,
    });
    expect(follows.delete).toHaveBeenCalledWith({
      userId: 'u',
      channelId: 'cs2',
    });
  });
  it('passes the followed channels aliases to the paginated post query', async () => {
    follows.find.mockResolvedValue([{ channel }]);
    forum.findChannelPosts.mockResolvedValue({
      posts: [],
      total: 0,
      page: 2,
      limit: 10,
    });
    await service.feed('u', 2, 10);
    expect(forum.findChannelPosts).toHaveBeenCalledWith(channel.aliases, 2, 10);
    follows.find.mockResolvedValue([]);
    await expect(service.feed('u', 1, 10)).resolves.toEqual({
      posts: [],
      total: 0,
      page: 1,
      limit: 10,
    });
  });
});

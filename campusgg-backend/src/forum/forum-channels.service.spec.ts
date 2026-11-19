import { NotFoundException } from '@nestjs/common';
import { ForumChannelsService } from './forum-channels.service';
import { ForumService } from './forum.service';
import { ForumChannelFollow } from './forum-channel-follow.entity';
import { ForumChannel } from './forum-channel.entity';
import { Repository } from 'typeorm';

describe('ForumChannelsService', () => {
  const cs2 = {
    id: 'counter-strike-2',
    slug: 'counter-strike-2',
    name: 'CS2',
    aliases: ['cs2', 'counter-strike 2'],
  };
  const channels = { find: jest.fn(), findOneBy: jest.fn() };
  const forum = { findChannelPosts: jest.fn() };
  const countQuery = {
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    getRawMany: jest.fn(),
  };
  const follows = { createQueryBuilder: jest.fn(() => countQuery) };
  const service = new ForumChannelsService(
    channels as unknown as Repository<ForumChannel>,
    forum as unknown as ForumService,
    follows as unknown as Repository<ForumChannelFollow>,
  );
  beforeEach(() => jest.clearAllMocks());
  it('lists persisted channels and their matching aliases', async () => {
    channels.find.mockResolvedValue([cs2]);
    countQuery.getRawMany.mockResolvedValue([
      { channelId: cs2.id, count: '2' },
    ]);
    await expect(service.list()).resolves.toEqual([
      { ...cs2, category: 'FPS', followerCount: 2 },
    ]);
  });
  it('resolves case-insensitive slugs and does not expose aliases in detail', async () => {
    channels.findOneBy.mockResolvedValue(cs2);
    await expect(service.get('COUNTER-STRIKE-2')).resolves.toEqual({
      id: cs2.id,
      slug: cs2.slug,
      name: cs2.name,
    });
    expect(channels.findOneBy).toHaveBeenCalledWith({ slug: cs2.slug });
  });
  it('returns 404 for unknown slugs', async () => {
    channels.findOneBy.mockResolvedValue(null);
    await expect(service.get('missing')).rejects.toThrow(NotFoundException);
    await expect(service.posts('missing', 1, 25)).rejects.toThrow(
      NotFoundException,
    );
  });
  it('passes all legacy aliases and page parameters to the database query', async () => {
    channels.findOneBy.mockResolvedValue(cs2);
    forum.findChannelPosts.mockResolvedValue({
      posts: [],
      total: 0,
      page: 2,
      limit: 10,
    });
    await expect(service.posts(cs2.slug, 2, 10)).resolves.toEqual({
      posts: [],
      total: 0,
      page: 2,
      limit: 10,
    });
    expect(forum.findChannelPosts).toHaveBeenCalledWith(cs2.aliases, 2, 10);
  });
});

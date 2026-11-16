import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { ForumChannel } from './forum-channel.entity';
import { ForumPost } from './forum-post.entity';
import { ForumRankingService } from './forum-ranking.service';

describe('ForumRankingService', () => {
  const query = jest.fn();
  const posts = {
    manager: {
      connection: {
        driver: { escape: (value: string) => `"${value}"` },
        options: { schema: 'public' },
      },
      query,
    },
  };
  const channels = { findOneBy: jest.fn() };
  const service = new ForumRankingService(
    posts as unknown as Repository<ForumPost>,
    channels as unknown as Repository<ForumChannel>,
  );
  beforeEach(() => jest.resetAllMocks());
  it('rejects invalid sorts, windows and pagination', async () => {
    await expect(
      service.rank({ sort: 'bad', window: 'all', page: 1, limit: 10 }),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.rank({ sort: 'hot', window: 'bad', page: 1, limit: 10 }),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.rank({ sort: 'hot', window: 'all', page: 1, limit: 101 }),
    ).rejects.toThrow(BadRequestException);
    expect(query).not.toHaveBeenCalled();
  });
  it('returns 404 for unknown channel slugs', async () => {
    channels.findOneBy.mockResolvedValue(null);
    await expect(
      service.channel('missing', 'new', 'all', 1, 10),
    ).rejects.toThrow(NotFoundException);
  });
  it('passes pagination and personal identity as bound parameters', async () => {
    query.mockResolvedValue([{ posts: [], total: 0 }]);
    await expect(
      service.rank({
        sort: 'hot',
        window: 'all',
        page: 2,
        limit: 10,
        personalized: true,
        userId: 'user-id',
      }),
    ).resolves.toEqual({ posts: [], total: 0, page: 2, limit: 10 });
    expect(query).toHaveBeenCalledWith(expect.any(String), ['user-id', 10, 10]);
  });
});

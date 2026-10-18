import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';

import { ForumService } from './forum.service';
import { ForumPost } from './forum-post.entity';
import { ForumPostLike } from './forum-post-like.entity';
import { User } from '../users/user.entity';

describe('ForumService', () => {
  let service: ForumService;

  const postsRepositoryMock = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    remove: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const usersRepositoryMock = {
    findOne: jest.fn(),
    findOneBy: jest.fn(),
  };

  const likesRepositoryMock = {
    createQueryBuilder: jest.fn(),
    count: jest.fn(),
    findOne: jest.fn(),
    findOneBy: jest.fn(),
  };

  beforeEach(async () => {
    jest.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ForumService,
        {
          provide: getRepositoryToken(ForumPost),
          useValue: postsRepositoryMock,
        },
        {
          provide: getRepositoryToken(User),
          useValue: usersRepositoryMock,
        },
        {
          provide: getRepositoryToken(ForumPostLike),
          useValue: likesRepositoryMock,
        },
      ],
    }).compile();

    service = module.get<ForumService>(ForumService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should retrieve the like count for a post', async () => {
    const postId = 'test-post-id';

    postsRepositoryMock.findOneBy.mockResolvedValue({
      id: postId,
    });

    likesRepositoryMock.count.mockResolvedValue(3);

    const result = await service.getLikeCount(postId);

    expect(result).toEqual({
      postId,
      likeCount: 3,
    });

    expect(postsRepositoryMock.findOneBy).toHaveBeenCalledWith({
      id: postId,
    });

    expect(likesRepositoryMock.count).toHaveBeenCalledWith({
      where: {
        post: {
          id: postId,
        },
      },
    });
  });

  it('should reject like-count requests for missing posts', async () => {
    postsRepositoryMock.findOneBy.mockResolvedValue(null);

    await expect(service.getLikeCount('missing-post')).rejects.toThrow(
      NotFoundException,
    );
  });
});

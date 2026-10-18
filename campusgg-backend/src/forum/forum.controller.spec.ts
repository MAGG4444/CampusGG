import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';

// Mock the guard before loading the controller.
// This avoids loading @nestjs/jwt in this unit test.
jest.mock('../auth/jwt-auth.guard', () => ({
  JwtAuthGuard: class {
    canActivate() {
      return true;
    }
  },
}));

import { ForumController } from './forum.controller';
import { ForumService } from './forum.service';

describe('ForumController', () => {
  let controller: ForumController;

  const forumServiceMock = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    likePost: jest.fn(),
    unlikePost: jest.fn(),
    getLikeCount: jest.fn(),
  };

  beforeEach(async () => {
    jest.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ForumController],
      providers: [
        {
          provide: ForumService,
          useValue: forumServiceMock,
        },
      ],
    }).compile();

    controller = module.get<ForumController>(ForumController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return paginated posts', async () => {
    const result = {
      posts: [],
      total: 0,
      page: 1,
      limit: 25,
    };

    forumServiceMock.findAll.mockResolvedValue(result);

    await expect(controller.findAll(1, 25)).resolves.toEqual(result);

    expect(forumServiceMock.findAll).toHaveBeenCalledWith(1, 25);
  });

  it('should retrieve a specific post', async () => {
    const postId = 'test-post-id';

    const post = {
      id: postId,
      title: 'Test Forum Post',
      content: 'Test content',
    };

    forumServiceMock.findOne.mockResolvedValue(post);

    await expect(controller.findOne(postId)).resolves.toEqual(post);

    expect(forumServiceMock.findOne).toHaveBeenCalledWith(postId);
  });

  it('should reject post creation without a user', () => {
    const dto = {
      title: 'Test Post',
      content: 'Test content',
    };

    expect(() =>
      controller.create(dto, {} as Parameters<ForumController['create']>[1]),
    ).toThrow(UnauthorizedException);

    expect(forumServiceMock.create).not.toHaveBeenCalled();
  });
});

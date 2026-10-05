import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { User } from './user.entity';
import { CreateUserDto } from './dto/create-user.dto';

describe('UsersController', () => {
  let controller: UsersController;
  let service: Partial<Record<keyof UsersService, jest.Mock>>;

  beforeEach(async () => {
    service = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: service,
        },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should not leak verificationToken or password on findAll', async () => {
    const rawUser: User = {
      id: 'uuid-1',
      email: 'student@purdue.edu',
      username: 'student',
      displayName: 'Student One',
      eduVerified: false,
      verificationToken: 'secret-leak-token',
      password: 'secret-password-hash',
      tokenExpiresAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    service.findAll!.mockResolvedValue([rawUser]);

    const results = await controller.findAll();
    expect(results).toHaveLength(1);
    expect(results[0]).not.toHaveProperty('verificationToken');
    expect(results[0]).not.toHaveProperty('password');
    expect(results[0]).toHaveProperty('id', 'uuid-1');
    expect(results[0]).toHaveProperty('username', 'student');
  });

  it('should not leak verificationToken or password on findOne', async () => {
    const rawUser: User = {
      id: 'uuid-1',
      email: 'student@purdue.edu',
      username: 'student',
      displayName: 'Student One',
      eduVerified: false,
      verificationToken: 'secret-leak-token',
      password: 'secret-password-hash',
      tokenExpiresAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    service.findOne!.mockResolvedValue(rawUser);

    const result = await controller.findOne('uuid-1');
    expect(result).not.toHaveProperty('verificationToken');
    expect(result).not.toHaveProperty('password');
    expect(result).toHaveProperty('id', 'uuid-1');
  });

  it('should not leak verificationToken or password on create', async () => {
    const rawUser: User = {
      id: 'uuid-1',
      email: 'student@purdue.edu',
      username: 'student',
      displayName: 'Student One',
      eduVerified: false,
      verificationToken: 'secret-leak-token',
      password: 'secret-password-hash',
      tokenExpiresAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    service.create!.mockResolvedValue(rawUser);

    const dto: CreateUserDto = {
      email: 'student@purdue.edu',
      username: 'student',
      displayName: 'Student One',
    };

    const result = await controller.create(dto);
    expect(result).not.toHaveProperty('verificationToken');
    expect(result).not.toHaveProperty('password');
  });
});

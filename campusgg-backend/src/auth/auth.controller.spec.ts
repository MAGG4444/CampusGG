import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { User } from '../users/user.entity';
import { RegisterDto } from './dto/register.dto';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: Partial<Record<keyof AuthService, jest.Mock>>;

  beforeEach(async () => {
    authService = {
      register: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: authService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return user without verificationToken', async () => {
    const mockUser: User = {
      id: 'uuid-1',
      email: 'john@purdue.edu',
      username: 'johndoe',
      displayName: 'John Doe',
      eduVerified: false,
      verificationToken: 'secret-token-value',
      tokenExpiresAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    authService.register!.mockResolvedValue(mockUser);

    const dto: RegisterDto = {
      email: 'john@purdue.edu',
      username: 'johndoe',
      displayName: 'John Doe',
    };

    const result = await controller.register(dto);

    // verificationToken must NOT appear in the response
    expect(result).not.toHaveProperty('verificationToken');

    // Other fields should be present
    expect(result).toHaveProperty('id', 'uuid-1');
    expect(result).toHaveProperty('email', 'john@purdue.edu');
    expect(result).toHaveProperty('eduVerified', false);
  });
});

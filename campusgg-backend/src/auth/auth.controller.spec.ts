import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { User } from '../users/user.entity';
import { RegisterDto } from './dto/register.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: Partial<Record<keyof AuthService, jest.Mock>>;

  beforeEach(async () => {
    authService = {
      register: jest.fn(),
      verify: jest.fn(),
      verifyEmail: jest.fn(),
      resendVerification: jest.fn(),
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

  it('should return user without verificationToken and password on register', async () => {
    const mockUser: User = {
      id: 'uuid-1',
      email: 'john@purdue.edu',
      username: 'johndoe',
      displayName: 'John Doe',
      eduVerified: false,
      verificationToken: 'secret-token-value',
      password: 'hashed-password',
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

    expect(result).not.toHaveProperty('verificationToken');
    expect(result).not.toHaveProperty('password');
    expect(result).toHaveProperty('id', 'uuid-1');
    expect(result).toHaveProperty('email', 'john@purdue.edu');
    expect(result).toHaveProperty('eduVerified', false);
  });

  // ── GET /api/auth/verify ───────────────────────────────────────────────

  it('should return 200 JSON confirmation when verifyEmail succeeds', async () => {
    authService.verifyEmail!.mockResolvedValue({
      message: 'Email verified successfully. You can now log in.',
    });

    const result = await controller.verify('valid-token');

    expect(authService.verifyEmail).toHaveBeenCalledWith('valid-token');
    expect(result).toEqual({
      statusCode: 200,
      message: 'Email verified successfully. You can now log in.',
    });
  });

  it('should propagate BadRequestException when token is invalid', async () => {
    authService.verifyEmail!.mockRejectedValue(
      new BadRequestException('Invalid verification token'),
    );

    await expect(controller.verify('invalid-token')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should propagate BadRequestException when token has expired', async () => {
    authService.verifyEmail!.mockRejectedValue(
      new BadRequestException('Verification token has expired'),
    );

    await expect(controller.verify('expired-token')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should call resendVerification on auth service', async () => {
    authService.resendVerification!.mockResolvedValue({
      message: 'Email sent.',
    });

    const dto: ResendVerificationDto = {
      email: 'john@purdue.edu',
    };

    const result = await controller.resendVerification(dto);
    expect(authService.resendVerification).toHaveBeenCalledWith(
      'john@purdue.edu',
    );
    expect(result).toEqual({ message: 'Email sent.' });
  });
});

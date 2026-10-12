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
      verificationToken: '482910',
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

  // ── POST /api/auth/verify ──────────────────────────────────────────────

  it('should return 200 JSON confirmation when verifyEmail succeeds', async () => {
    authService.verifyEmail!.mockResolvedValue({
      statusCode: 200,
      message: 'Email verified successfully.',
    });

    const result = await controller.verify({
      email: 'john@purdue.edu',
      code: '482910',
    });

    expect(authService.verifyEmail).toHaveBeenCalledWith(
      'john@purdue.edu',
      '482910',
    );
    expect(result).toEqual({
      statusCode: 200,
      message: 'Email verified successfully.',
    });
  });

  it('should propagate BadRequestException when code is invalid', async () => {
    authService.verifyEmail!.mockRejectedValue(
      new BadRequestException('Invalid verification code'),
    );

    await expect(
      controller.verify({ email: 'john@purdue.edu', code: '000000' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should propagate BadRequestException when code has expired', async () => {
    authService.verifyEmail!.mockRejectedValue(
      new BadRequestException(
        'Verification code has expired. Please request a new one.',
      ),
    );

    await expect(
      controller.verify({ email: 'john@purdue.edu', code: '482910' }),
    ).rejects.toThrow(BadRequestException);
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

import * as bcrypt from 'bcryptjs';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { Repository } from 'typeorm';

import { AuthService } from './auth.service';
import { User } from '../users/user.entity';
import { RegisterDto } from './dto/register.dto';
import { MailService } from './mail.service';

/**
 * Creates a mock TypeORM Repository with jest.fn() stubs for the methods
 * used by AuthService.
 */
function createMockRepository(): Partial<
  Record<keyof Repository<User>, jest.Mock>
> {
  return {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };
}

describe('AuthService', () => {
  let service: AuthService;
  let repo: ReturnType<typeof createMockRepository>;
  let mailService: { sendVerificationEmail: jest.Mock };

  beforeEach(async () => {
    repo = createMockRepository();
    mailService = {
      sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(User),
          useValue: repo,
        },
        {
          provide: MailService,
          useValue: mailService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  // ── Helper ────────────────────────────────────────────────────────────

  const validDto: RegisterDto = {
    email: '  John@Purdue.EDU  ',
    username: '  johndoe  ',
    displayName: '  John Doe  ',
  };

  // ── .edu validation ──────────────────────────────────────────────────

  it('should reject a non-.edu email with BadRequestException', async () => {
    const dto: RegisterDto = { ...validDto, email: 'john@gmail.com' };
    await expect(service.register(dto)).rejects.toThrow(BadRequestException);
  });

  it('should reject an email without a domain', async () => {
    const dto: RegisterDto = { ...validDto, email: 'john@edu' };
    await expect(service.register(dto)).rejects.toThrow(BadRequestException);
  });

  it('should reject a completely invalid email string', async () => {
    const dto: RegisterDto = { ...validDto, email: 'not-an-email' };
    await expect(service.register(dto)).rejects.toThrow(BadRequestException);
  });

  it('should reject malformed domains like hyphens or double dots', async () => {
    await expect(
      service.register({ ...validDto, email: 'a@-purdue.edu' }),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.register({ ...validDto, email: 'a@purdue..edu' }),
    ).rejects.toThrow(BadRequestException);
  });

  // ── Duplicate checks ─────────────────────────────────────────────────

  it('should throw ConflictException for duplicate email', async () => {
    repo.findOne!.mockResolvedValueOnce({ id: 'existing' } as User);
    await expect(service.register(validDto)).rejects.toThrow(ConflictException);
  });

  it('should throw ConflictException for duplicate username', async () => {
    repo.findOne!.mockResolvedValueOnce(null);
    repo.findOne!.mockResolvedValueOnce({ id: 'existing' } as User);
    await expect(service.register(validDto)).rejects.toThrow(ConflictException);
  });

  // ── Successful registration ──────────────────────────────────────────

  it('should normalize email to lowercase and trimmed', async () => {
    repo.findOne!.mockResolvedValue(null);
    repo.create!.mockImplementation((data) => data as User);
    repo.save!.mockImplementation((user) => Promise.resolve(user as User));

    await service.register(validDto);

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'john@purdue.edu',
        username: 'johndoe',
        displayName: 'John Doe',
      }),
    );
  });

  it('should generate a 6-digit numeric code, set 10-minute expiration, and send code via email', async () => {
    repo.findOne!.mockResolvedValue(null);
    repo.create!.mockImplementation((data) => data as User);
    repo.save!.mockImplementation((user) => Promise.resolve(user as User));

    const before = Date.now();
    const result = await service.register(validDto);
    const after = Date.now();

    expect(result.verificationToken).toBeDefined();
    expect(result.verificationToken).toMatch(/^\d{6}$/);

    // Check expiration is ~10 minutes (10 * 60 * 1000 ms) from creation
    const expectedMin = before + 10 * 60 * 1000;
    const expectedMax = after + 10 * 60 * 1000;
    expect(result.tokenExpiresAt).toBeInstanceOf(Date);
    expect(result.tokenExpiresAt!.getTime()).toBeGreaterThanOrEqual(
      expectedMin,
    );
    expect(result.tokenExpiresAt!.getTime()).toBeLessThanOrEqual(expectedMax);

    expect(mailService.sendVerificationEmail).toHaveBeenCalledTimes(1);
    const sentCode = (
      mailService.sendVerificationEmail.mock.calls as [unknown[]]
    )[0][2] as string;
    expect(sentCode).toBe(result.verificationToken);
  });

  it('should hash password when provided in RegisterDto', async () => {
    repo.findOne!.mockResolvedValue(null);
    repo.create!.mockImplementation((data) => data as User);
    repo.save!.mockImplementation((user) => Promise.resolve(user as User));

    const result = await service.register({
      ...validDto,
      password: 'MySecretPassword123',
    });

    expect(result.password).toBeDefined();
    expect(result.password).not.toBe('MySecretPassword123');
    const matches = await bcrypt.compare(
      'MySecretPassword123',
      result.password!,
    );
    expect(matches).toBe(true);
  });

  it('should handle unique constraint race condition by throwing ConflictException', async () => {
    repo.findOne!.mockResolvedValue(null);
    repo.create!.mockImplementation((data) => data as User);
    repo.save!.mockRejectedValueOnce({ code: '23505' });

    await expect(service.register(validDto)).rejects.toThrow(ConflictException);
  });

  it('should not lock out user if mail service fails', async () => {
    repo.findOne!.mockResolvedValue(null);
    repo.create!.mockImplementation((data) => data as User);
    repo.save!.mockImplementation((user) =>
      Promise.resolve({ ...(user as User), id: 'mock-user-id' }),
    );
    mailService.sendVerificationEmail.mockRejectedValueOnce(
      new Error('SMTP down'),
    );

    const result = await service.register(validDto);
    expect(result.id).toBeDefined();
  });

  // ── Verification logic (6-Digit OTP) ─────────────────────────────────

  it('should successfully verify user and consume code in verifyEmail', async () => {
    const mockUnverifiedUser: User = {
      id: 'user-1',
      email: 'john@purdue.edu',
      username: 'johndoe',
      displayName: 'John Doe',
      eduVerified: false,
      verificationToken: '482910',
      tokenExpiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 mins in future
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    repo.findOne!.mockResolvedValueOnce(mockUnverifiedUser);
    repo.save!.mockImplementation((user) => Promise.resolve(user as User));

    const result = await service.verifyEmail('john@purdue.edu', '482910');

    expect(result).toEqual({
      statusCode: 200,
      message: 'Email verified successfully.',
    });
    expect(mockUnverifiedUser.eduVerified).toBe(true);
    expect(mockUnverifiedUser.verificationToken).toBeNull();
    expect(mockUnverifiedUser.tokenExpiresAt).toBeNull();
    expect(repo.save).toHaveBeenCalledTimes(1);
  });

  it('should throw BadRequestException if user is not found by email', async () => {
    repo.findOne!.mockResolvedValueOnce(null);

    await expect(
      service.verifyEmail('nonexistent@purdue.edu', '123456'),
    ).rejects.toThrow(BadRequestException);
  });

  it('should throw BadRequestException if code does not match verificationToken', async () => {
    const mockUnverifiedUser: User = {
      id: 'user-1',
      email: 'john@purdue.edu',
      username: 'johndoe',
      displayName: 'John Doe',
      eduVerified: false,
      verificationToken: '482910',
      tokenExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    repo.findOne!.mockResolvedValueOnce(mockUnverifiedUser);

    await expect(
      service.verifyEmail('john@purdue.edu', '999999'),
    ).rejects.toThrow('Invalid verification code');
  });

  it('should throw BadRequestException if verification code has expired', async () => {
    const mockExpiredUser: User = {
      id: 'user-1',
      email: 'john@purdue.edu',
      username: 'johndoe',
      displayName: 'John Doe',
      eduVerified: false,
      verificationToken: '482910',
      tokenExpiresAt: new Date(Date.now() - 1000), // in the past
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    repo.findOne!.mockResolvedValueOnce(mockExpiredUser);

    await expect(
      service.verifyEmail('john@purdue.edu', '482910'),
    ).rejects.toThrow(
      'Verification code has expired. Please request a new one.',
    );
  });

  it('should reject empty or whitespace code in verifyEmail', async () => {
    await expect(service.verifyEmail('john@purdue.edu', '   ')).rejects.toThrow(
      'Invalid verification code',
    );
  });

  // ── Resend verification ───────────────────────────────────────────────

  it('should resend fresh 6-digit verification code for unverified user', async () => {
    const mockUser: User = {
      id: 'user-1',
      email: 'john@purdue.edu',
      username: 'johndoe',
      displayName: 'John Doe',
      eduVerified: false,
      verificationToken: '111111',
      tokenExpiresAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    repo.findOne!.mockResolvedValueOnce(mockUser);
    repo.save!.mockImplementation((user) => Promise.resolve(user as User));

    const response = await service.resendVerification('john@purdue.edu');

    expect(response.message).toContain('sent');
    expect(mockUser.verificationToken).toMatch(/^\d{6}$/);
    expect(mailService.sendVerificationEmail).toHaveBeenCalledTimes(1);
  });

  it('should reject resend for already verified account', async () => {
    const mockVerifiedUser: User = {
      id: 'user-1',
      email: 'john@purdue.edu',
      username: 'johndoe',
      displayName: 'John Doe',
      eduVerified: true,
      verificationToken: null,
      tokenExpiresAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    repo.findOne!.mockResolvedValueOnce(mockVerifiedUser);

    await expect(service.resendVerification('john@purdue.edu')).rejects.toThrow(
      BadRequestException,
    );
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { Repository } from 'typeorm';

import { AuthService } from './auth.service';
import { User } from '../users/user.entity';
import { RegisterDto } from './dto/register.dto';

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

  beforeEach(async () => {
    repo = createMockRepository();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(User),
          useValue: repo,
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

  // ── Duplicate checks ─────────────────────────────────────────────────

  it('should throw ConflictException for duplicate email', async () => {
    repo.findOne!.mockResolvedValueOnce({ id: 'existing' } as User);

    await expect(service.register(validDto)).rejects.toThrow(ConflictException);
  });

  it('should throw ConflictException for duplicate username', async () => {
    // First findOne (email check) returns null — no duplicate email
    repo.findOne!.mockResolvedValueOnce(null);
    // Second findOne (username check) returns a user — duplicate username
    repo.findOne!.mockResolvedValueOnce({ id: 'existing' } as User);

    await expect(service.register(validDto)).rejects.toThrow(ConflictException);
  });

  // ── Successful registration ──────────────────────────────────────────

  it('should normalize email to lowercase and trimmed', async () => {
    repo.findOne!.mockResolvedValue(null);
    repo.create!.mockImplementation((data) => data as User);
    repo.save!.mockImplementation(async (user) => user as User);

    await service.register(validDto);

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'john@purdue.edu',
        username: 'johndoe',
        displayName: 'John Doe',
      }),
    );
  });

  it('should generate a 64-char hex verification token', async () => {
    repo.findOne!.mockResolvedValue(null);
    repo.create!.mockImplementation((data) => data as User);
    repo.save!.mockImplementation(async (user) => user as User);

    const result = await service.register(validDto);

    expect(result.verificationToken).toBeDefined();
    expect(result.verificationToken).toHaveLength(64);
    expect(result.verificationToken).toMatch(/^[0-9a-f]{64}$/);
  });

  it('should set tokenExpiresAt roughly 24 hours in the future', async () => {
    repo.findOne!.mockResolvedValue(null);
    repo.create!.mockImplementation((data) => data as User);
    repo.save!.mockImplementation(async (user) => user as User);

    const before = Date.now();
    const result = await service.register(validDto);
    const after = Date.now();

    const expiresMs = result.tokenExpiresAt!.getTime();
    const twentyFourHours = 24 * 60 * 60 * 1000;

    expect(expiresMs).toBeGreaterThanOrEqual(before + twentyFourHours - 1000);
    expect(expiresMs).toBeLessThanOrEqual(after + twentyFourHours + 1000);
  });

  it('should set eduVerified to false', async () => {
    repo.findOne!.mockResolvedValue(null);
    repo.create!.mockImplementation((data) => data as User);
    repo.save!.mockImplementation(async (user) => user as User);

    await service.register(validDto);

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ eduVerified: false }),
    );
  });
});

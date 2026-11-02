import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { App } from 'supertest/types';

import { AuthController } from '../src/auth/auth.controller';
import { AuthService } from '../src/auth/auth.service';
import { MailService } from '../src/auth/mail.service';
import { User } from '../src/users/user.entity';

type FindOneOptionsLike = {
  where: {
    email?: string;
    username?: string | { value?: string };
  };
};

/**
 * Minimal in-memory stand-in for the TypeORM user repository.
 *
 * The integration test is intentionally database-free: it verifies the
 * HTTP -> controller -> service -> repository contract without requiring
 * PostgreSQL, Redis, or any external service in CI.
 */
class InMemoryUserRepository {
  private readonly users = new Map<string, User>();
  private sequence = 0;

  create(input: Partial<User>): User {
    return { ...input } as User;
  }

  save(user: User): Promise<User> {
    if (!user.id) {
      user.id = `user-${++this.sequence}`;
    }
    if (!user.createdAt) {
      user.createdAt = new Date();
    }
    user.updatedAt = new Date();
    this.users.set(user.id, user);
    return Promise.resolve(user);
  }

  findOne(options: FindOneOptionsLike): Promise<User | null> {
    const { email, username } = options.where;

    if (email) {
      return Promise.resolve(this.findByEmail(email));
    }

    if (username !== undefined) {
      const value =
        typeof username === 'string' ? username : (username.value ?? '');
      return Promise.resolve(this.findByUsername(value));
    }

    return Promise.resolve(null);
  }

  findByEmail(email: string): User | null {
    return (
      [...this.users.values()].find((user) => user.email === email) ?? null
    );
  }

  findByUsername(username: string): User | null {
    const normalized = username.toLowerCase();
    return (
      [...this.users.values()].find(
        (user) => user.username.toLowerCase() === normalized,
      ) ?? null
    );
  }

  all(): User[] {
    return [...this.users.values()];
  }
}

type RegisterResponseBody = {
  email: string;
  username: string;
  displayName: string;
  eduVerified: boolean;
};

type ErrorResponseBody = {
  message: string;
  statusCode?: number;
};

type ValidationErrorResponseBody = {
  message: string[];
  statusCode?: number;
};

function bodyAs<T>(response: { body: unknown }): T {
  return response.body as T;
}

describe('Auth integration (e2e)', () => {
  let app: INestApplication<App>;
  let repository: InMemoryUserRepository;
  let mailService: {
    sendVerificationEmail: jest.Mock<Promise<void>, [string, string, string]>;
  };

  const registration = {
    email: 'student@purdue.edu',
    username: 'boilermaker',
    displayName: 'Boiler Maker',
    password: 'password123',
  };

  beforeEach(async () => {
    repository = new InMemoryUserRepository();
    mailService = {
      sendVerificationEmail: jest
        .fn<Promise<void>, [string, string, string]>()
        .mockResolvedValue(undefined),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(User),
          useValue: repository,
        },
        {
          provide: MailService,
          useValue: mailService,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  function register(overrides: Partial<typeof registration> = {}) {
    return request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ ...registration, ...overrides });
  }

  function verify(email: string, code: string) {
    return request(app.getHttpServer())
      .post('/api/auth/verify')
      .send({ email, code });
  }

  function resend(email: string) {
    return request(app.getHttpServer())
      .post('/api/auth/resend-verification')
      .send({ email });
  }

  function latestVerificationCode(): string {
    const calls = mailService.sendVerificationEmail.mock.calls;
    return calls[calls.length - 1][2];
  }

  it('registers a .edu user, persists a 6-digit OTP, and sends it by email', async () => {
    const beforeRequest = Date.now();
    const response = await register();

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      email: 'student@purdue.edu',
      username: 'boilermaker',
      displayName: 'Boiler Maker',
      eduVerified: false,
    });
    expect(response.body).not.toHaveProperty('verificationToken');
    expect(response.body).not.toHaveProperty('password');

    expect(mailService.sendVerificationEmail).toHaveBeenCalledTimes(1);
    const [email, username, code] =
      mailService.sendVerificationEmail.mock.calls[0];
    expect(email).toBe('student@purdue.edu');
    expect(username).toBe('boilermaker');
    expect(code).toMatch(/^\d{6}$/);
    expect(code).toBe(latestVerificationCode());

    const stored = repository.findByEmail('student@purdue.edu');
    expect(stored).not.toBeNull();
    expect(stored?.verificationToken).toBe(code);
    expect(stored?.tokenExpiresAt).toBeInstanceOf(Date);

    const ttlMs = (stored?.tokenExpiresAt?.getTime() ?? 0) - beforeRequest;
    expect(ttlMs).toBeGreaterThanOrEqual(9 * 60 * 1000);
    expect(ttlMs).toBeLessThanOrEqual(11 * 60 * 1000);
  });

  it('lowercases the email and trims the username before storing them', async () => {
    const response = await register({
      email: 'Student@Purdue.EDU',
      username: '  Boilermaker  ',
    });

    const body = bodyAs<RegisterResponseBody>(response);
    expect(response.status).toBe(201);
    expect(body.email).toBe('student@purdue.edu');
    expect(body.username).toBe('Boilermaker');
    expect(repository.findByEmail('student@purdue.edu')).not.toBeNull();
  });

  it('rejects a non-.edu email without creating a user or sending mail', async () => {
    const response = await register({ email: 'student@gmail.com' });
    const body = bodyAs<ErrorResponseBody>(response);

    expect(response.status).toBe(400);
    expect(body.message).toContain('.edu');
    expect(mailService.sendVerificationEmail).not.toHaveBeenCalled();
    expect(repository.all()).toHaveLength(0);
  });

  it('rejects a duplicate email address', async () => {
    await repository.save(
      repository.create({
        email: 'student@purdue.edu',
        username: 'existing',
        displayName: 'Existing User',
        eduVerified: true,
        verificationToken: null,
        tokenExpiresAt: null,
      }),
    );

    const response = await register({ username: 'differentusername' });
    const body = bodyAs<ErrorResponseBody>(response);

    expect(response.status).toBe(409);
    expect(body.message).toContain('already exists');
    expect(mailService.sendVerificationEmail).not.toHaveBeenCalled();
  });

  it('rejects a duplicate username', async () => {
    await repository.save(
      repository.create({
        email: 'other@purdue.edu',
        username: 'boilermaker',
        displayName: 'Existing User',
        eduVerified: true,
        verificationToken: null,
        tokenExpiresAt: null,
      }),
    );

    const response = await register();
    const body = bodyAs<ErrorResponseBody>(response);

    expect(response.status).toBe(409);
    expect(body.message).toContain('already taken');
    expect(mailService.sendVerificationEmail).not.toHaveBeenCalled();
  });

  it('verifies a user with the correct code and consumes the token', async () => {
    await register();
    const code = latestVerificationCode();

    const response = await verify('student@purdue.edu', code);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      statusCode: 200,
      message: 'Email verified successfully.',
    });

    const stored = repository.findByEmail('student@purdue.edu');
    expect(stored?.eduVerified).toBe(true);
    expect(stored?.verificationToken).toBeNull();
    expect(stored?.tokenExpiresAt).toBeNull();
  });

  it('rejects an incorrect verification code', async () => {
    await register();

    const response = await verify('student@purdue.edu', '000000');
    const body = bodyAs<ErrorResponseBody>(response);

    expect(response.status).toBe(400);
    expect(body.message).toBe('Invalid verification code');
    expect(repository.findByEmail('student@purdue.edu')?.eduVerified).toBe(
      false,
    );
  });

  it('rejects an expired verification code', async () => {
    await register();
    const stored = repository.findByEmail('student@purdue.edu');
    expect(stored).not.toBeNull();

    stored!.tokenExpiresAt = new Date(Date.now() - 1_000);
    await repository.save(stored!);

    const response = await verify(
      'student@purdue.edu',
      latestVerificationCode(),
    );

    const body = bodyAs<ErrorResponseBody>(response);

    expect(response.status).toBe(400);
    expect(body.message).toContain('expired');
    expect(repository.findByEmail('student@purdue.edu')?.eduVerified).toBe(
      false,
    );
  });

  it('rejects reusing a verification code after it was consumed', async () => {
    await register();
    const code = latestVerificationCode();

    expect((await verify('student@purdue.edu', code)).status).toBe(200);

    const response = await verify('student@purdue.edu', code);
    const body = bodyAs<ErrorResponseBody>(response);

    expect(response.status).toBe(400);
    expect(body.message).toBe('Invalid verification code');
  });

  it('resends a fresh code to an unverified user', async () => {
    await register();
    const firstCode = latestVerificationCode();

    const response = await resend('student@purdue.edu');
    const body = bodyAs<ErrorResponseBody>(response);

    expect(response.status).toBe(200);
    expect(body.message).toContain('fresh verification code');
    expect(mailService.sendVerificationEmail).toHaveBeenCalledTimes(2);

    const secondCode = latestVerificationCode();
    expect(secondCode).toMatch(/^\d{6}$/);
    expect(
      repository.findByEmail('student@purdue.edu')?.verificationToken,
    ).toBe(secondCode);

    // The resent code is the one that must work; the old code may only work
    // if the random generator happened to produce the same value.
    const verifyResponse = await verify('student@purdue.edu', secondCode);
    expect(verifyResponse.status).toBe(200);
    expect(firstCode).toMatch(/^\d{6}$/);
  });

  it('does not reveal whether an unknown email exists when resending', async () => {
    const response = await resend('unknown@purdue.edu');
    const body = bodyAs<ErrorResponseBody>(response);

    expect(response.status).toBe(200);
    expect(body.message).toContain('If an account with this email exists');
    expect(mailService.sendVerificationEmail).not.toHaveBeenCalled();
  });

  it('rejects resending a code for an already verified account', async () => {
    await register();
    await verify('student@purdue.edu', latestVerificationCode());

    const response = await resend('student@purdue.edu');
    const body = bodyAs<ErrorResponseBody>(response);

    expect(response.status).toBe(400);
    expect(body.message).toBe('This account is already verified.');
    expect(mailService.sendVerificationEmail).toHaveBeenCalledTimes(1);
  });

  it('rejects a malformed registration payload before reaching the service', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: 'not-an-email', username: 'ab' });

    const body = bodyAs<ValidationErrorResponseBody>(response);

    expect(response.status).toBe(400);
    expect(Array.isArray(body.message)).toBe(true);
    expect(mailService.sendVerificationEmail).not.toHaveBeenCalled();
    expect(repository.all()).toHaveLength(0);
  });
});

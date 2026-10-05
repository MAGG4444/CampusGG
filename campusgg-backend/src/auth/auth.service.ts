import * as crypto from 'crypto';
import * as bcrypt from 'bcryptjs';

import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';

import { User } from '../users/user.entity';
import { RegisterDto } from './dto/register.dto';
import { MailService } from './mail.service';

/**
 * Strict regex that matches a valid .edu email address with proper domain segments.
 * Disallows leading/trailing hyphens, consecutive dots, and requires a valid domain label before .edu.
 */
const EDU_EMAIL_REGEX =
  /^[a-zA-Z0-9._%+-]+@(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[eE][dD][uU]$/;

/** How many random bytes to use for the verification token (32 = 64 hex chars). */
const TOKEN_BYTE_LENGTH = 32;

/** How long (in milliseconds) a verification token stays valid (24 hours). */
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly mailService: MailService,
  ) {}

  /**
   * Register a new user with a verified .edu email address.
   */
  async register(registerDto: RegisterDto): Promise<User> {
    if (!registerDto?.email || typeof registerDto.email !== 'string') {
      throw new BadRequestException('A valid email address is required.');
    }
    if (!registerDto?.username || typeof registerDto.username !== 'string') {
      throw new BadRequestException('A valid username is required.');
    }
    if (
      !registerDto?.displayName ||
      typeof registerDto.displayName !== 'string'
    ) {
      throw new BadRequestException('A valid display name is required.');
    }

    const email = registerDto.email.trim().toLowerCase();
    const username = registerDto.username.trim();
    const displayName = registerDto.displayName.trim();

    // ── 1. Validate .edu email ───────────────────────────────────────────
    if (!EDU_EMAIL_REGEX.test(email)) {
      throw new BadRequestException(
        'A valid .edu email address is required to register on CampusGG.',
      );
    }

    // ── 2. Check for duplicate email or username (case-insensitive) ─────
    const existingEmail = await this.usersRepository.findOne({
      where: { email },
    });
    if (existingEmail) {
      throw new ConflictException('An account with this email already exists.');
    }

    const existingUsername = await this.usersRepository.findOne({
      where: { username: ILike(username) },
    });
    if (existingUsername) {
      throw new ConflictException('This username is already taken.');
    }

    // ── 3. Hash password if provided ─────────────────────────────────────
    let hashedPassword: string | undefined = undefined;
    if (registerDto.password) {
      hashedPassword = await bcrypt.hash(registerDto.password, 10);
    }

    // ── 4. Generate verification token and hash for storage ──────────────
    const rawToken = crypto.randomBytes(TOKEN_BYTE_LENGTH).toString('hex');
    const tokenHash = crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');
    const tokenExpiresAt = new Date(Date.now() + TOKEN_TTL_MS);

    // ── 5. Persist user with token hash ──────────────────────────────────
    const user = this.usersRepository.create({
      email,
      username,
      displayName,
      eduVerified: false,
      verificationToken: tokenHash,
      tokenExpiresAt,
      password: hashedPassword,
    });

    let savedUser: User;
    try {
      savedUser = await this.usersRepository.save(user);
    } catch (err: unknown) {
      if (
        err &&
        typeof err === 'object' &&
        'code' in err &&
        (err as { code: string }).code === '23505'
      ) {
        throw new ConflictException(
          'An account with this email or username already exists.',
        );
      }
      throw err;
    }

    // ── 6. Send verification email (non-blocking for user creation) ──────
    try {
      await this.mailService.sendVerificationEmail(
        savedUser.email,
        savedUser.username,
        rawToken,
      );
    } catch (mailError) {
      this.logger.error(
        `Failed to send verification email to ${savedUser.email}:`,
        mailError,
      );
    }

    return savedUser;
  }

  /**
   * Verify a student email account using the verification token (Issue #20).
   */
  async verifyEmail(token: string): Promise<{ message: string }> {
    if (!token || typeof token !== 'string' || !token.trim()) {
      throw new BadRequestException('Invalid verification token');
    }

    const rawToken = token.trim();
    const tokenHash = crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');

    const user = await this.usersRepository.findOne({
      where: [
        { verificationToken: tokenHash },
        { verificationToken: rawToken },
      ],
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        eduVerified: true,
        verificationToken: true,
        tokenExpiresAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new BadRequestException('Invalid verification token');
    }

    if (!user.tokenExpiresAt || user.tokenExpiresAt < new Date()) {
      throw new BadRequestException('Verification token has expired');
    }

    // Mark as verified and securely nullify token and expiration to prevent reuse
    user.eduVerified = true;
    user.verificationToken = null;
    user.tokenExpiresAt = null;

    await this.usersRepository.save(user);

    return {
      message: 'Email verified successfully. You can now log in.',
    };
  }

  /**
   * Verify a student email account using the raw verification token (returns User).
   */
  async verify(rawToken: string): Promise<User> {
    if (!rawToken || typeof rawToken !== 'string' || !rawToken.trim()) {
      throw new BadRequestException('Invalid verification token');
    }

    const token = rawToken.trim();
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const user = await this.usersRepository.findOne({
      where: [{ verificationToken: tokenHash }, { verificationToken: token }],
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        eduVerified: true,
        verificationToken: true,
        tokenExpiresAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new BadRequestException('Invalid verification token');
    }

    if (!user.tokenExpiresAt || user.tokenExpiresAt < new Date()) {
      throw new BadRequestException('Verification token has expired');
    }

    // Mark as verified and consume the token
    user.eduVerified = true;
    user.verificationToken = null;
    user.tokenExpiresAt = null;

    return this.usersRepository.save(user);
  }

  /**
   * Resend verification email to an unverified user.
   */
  async resendVerification(emailInput: string): Promise<{ message: string }> {
    if (!emailInput || typeof emailInput !== 'string') {
      throw new BadRequestException('A valid email address is required.');
    }

    const email = emailInput.trim().toLowerCase();
    if (!EDU_EMAIL_REGEX.test(email)) {
      throw new BadRequestException('A valid .edu email address is required.');
    }

    const user = await this.usersRepository.findOne({
      where: { email },
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        eduVerified: true,
        verificationToken: true,
        tokenExpiresAt: true,
      },
    });

    if (!user) {
      return {
        message:
          'If an account with this email exists, a verification link has been sent.',
      };
    }

    if (user.eduVerified) {
      throw new BadRequestException('This account is already verified.');
    }

    const rawToken = crypto.randomBytes(TOKEN_BYTE_LENGTH).toString('hex');
    const tokenHash = crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');
    const tokenExpiresAt = new Date(Date.now() + TOKEN_TTL_MS);

    user.verificationToken = tokenHash;
    user.tokenExpiresAt = tokenExpiresAt;
    await this.usersRepository.save(user);

    try {
      await this.mailService.sendVerificationEmail(
        user.email,
        user.username,
        rawToken,
      );
    } catch (mailError) {
      this.logger.error(
        `Failed to send verification email to ${user.email}:`,
        mailError,
      );
    }

    return {
      message: 'A fresh verification link has been sent to your email address.',
    };
  }
}

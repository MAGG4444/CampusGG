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

/** How long (in milliseconds) a verification code stays valid (10 minutes). */
const TOKEN_TTL_MS = 10 * 60 * 1000;

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
    const email = registerDto.email.trim().toLowerCase();
    const username = registerDto.username.trim();
    const displayName = (registerDto.displayName || username).trim();

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

    // ── 4. Generate 6-digit OTP verification code (expires in 10 minutes) ─
    const code = crypto.randomInt(100000, 999999).toString();
    const tokenExpiresAt = new Date(Date.now() + TOKEN_TTL_MS);

    // ── 5. Persist user with 6-digit code ────────────────────────────────
    const user = this.usersRepository.create({
      email,
      username,
      displayName,
      eduVerified: false,
      verificationToken: code,
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
        code,
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
   * Verify a student email account using their email and 6-digit OTP code.
   */
  async verifyEmail(
    emailInput: string,
    codeInput: string,
  ): Promise<{ statusCode: number; message: string }> {
    if (!emailInput || typeof emailInput !== 'string' || !emailInput.trim()) {
      throw new BadRequestException('A valid email address is required.');
    }
    if (!codeInput || typeof codeInput !== 'string' || !codeInput.trim()) {
      throw new BadRequestException('Invalid verification code');
    }

    const email = emailInput.trim().toLowerCase();
    const code = codeInput.trim();

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
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new BadRequestException('User not found.');
    }

    if (!user.verificationToken || user.verificationToken !== code) {
      throw new BadRequestException('Invalid verification code');
    }

    if (!user.tokenExpiresAt || user.tokenExpiresAt < new Date()) {
      throw new BadRequestException(
        'Verification code has expired. Please request a new one.',
      );
    }

    // Mark as verified and securely nullify token and expiration to prevent reuse
    user.eduVerified = true;
    user.verificationToken = null;
    user.tokenExpiresAt = null;

    await this.usersRepository.save(user);

    return {
      statusCode: 200,
      message: 'Email verified successfully.',
    };
  }

  /**
   * Resend verification email with a fresh 6-digit code to an unverified user.
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
          'If an account with this email exists, a verification code has been sent.',
      };
    }

    if (user.eduVerified) {
      throw new BadRequestException('This account is already verified.');
    }

    const code = crypto.randomInt(100000, 999999).toString();
    const tokenExpiresAt = new Date(Date.now() + TOKEN_TTL_MS);

    user.verificationToken = code;
    user.tokenExpiresAt = tokenExpiresAt;
    await this.usersRepository.save(user);

    try {
      await this.mailService.sendVerificationEmail(
        user.email,
        user.username,
        code,
      );
    } catch (mailError) {
      this.logger.error(
        `Failed to send verification email to ${user.email}:`,
        mailError,
      );
    }

    return {
      message: 'A fresh verification code has been sent to your email address.',
    };
  }
}

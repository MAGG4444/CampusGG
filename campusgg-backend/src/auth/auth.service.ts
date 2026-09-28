import * as crypto from 'crypto';

import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { User } from '../users/user.entity';
import { RegisterDto } from './dto/register.dto';
import { MailService } from './mail.service';

/** Regex that matches a valid .edu email address. */
const EDU_EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.edu$/i;

/** How many random bytes to use for the verification token (32 = 64 hex chars). */
const TOKEN_BYTE_LENGTH = 32;

/** How long (in milliseconds) a verification token stays valid. */
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly mailService: MailService,
  ) {}

  /**
   * Register a new user with a verified .edu email address.
   *
   * Steps:
   *   1. Normalize and validate the email ends with `.edu`.
   *   2. Check for duplicate email or username.
   *   3. Generate a cryptographically secure verification token.
   *   4. Save the user with `eduVerified: false`.
   *   5. Send verification email via MailService.
   *   6. Return the persisted user (token is stripped before HTTP response
   *      by the controller).
   */
  async register(registerDto: RegisterDto): Promise<User> {
    const email = registerDto.email.trim().toLowerCase();
    const username = registerDto.username.trim();
    const displayName = registerDto.displayName.trim();

    // ── 1. Validate .edu email ───────────────────────────────────────────
    if (!EDU_EMAIL_REGEX.test(email)) {
      throw new BadRequestException(
        'A valid .edu email address is required to register on CampusGG.',
      );
    }

    // ── 2. Check for duplicates ──────────────────────────────────────────
    const existingEmail = await this.usersRepository.findOne({
      where: { email },
    });
    if (existingEmail) {
      throw new ConflictException('An account with this email already exists.');
    }

    const existingUsername = await this.usersRepository.findOne({
      where: { username },
    });
    if (existingUsername) {
      throw new ConflictException('This username is already taken.');
    }

    // ── 3. Generate verification token ───────────────────────────────────
    const verificationToken = crypto
      .randomBytes(TOKEN_BYTE_LENGTH)
      .toString('hex');
    const tokenExpiresAt = new Date(Date.now() + TOKEN_TTL_MS);

    // ── 4. Persist ───────────────────────────────────────────────────────
    const user = this.usersRepository.create({
      email,
      username,
      displayName,
      eduVerified: false,
      verificationToken,
      tokenExpiresAt,
    });

    const savedUser = await this.usersRepository.save(user);

    // ── 5. Send verification email ───────────────────────────────────────
    await this.mailService.sendVerificationEmail(
      savedUser.email,
      savedUser.username,
      verificationToken,
    );

    return savedUser;
  }
}

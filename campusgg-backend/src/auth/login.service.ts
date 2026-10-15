import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';

import { User } from '../users/user.entity';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class LoginService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly jwtService: JwtService,
  ) {}

  async login(loginDto: LoginDto): Promise<{ access_token: string }> {
    // Normalize the email address
    const email = loginDto.email.trim().toLowerCase();

    // Explicitly retrieve the password hash.
    // The User entity excludes passwords by default.
    const user = await this.usersRepository.findOne({
      where: { email },
      select: {
        id: true,
        email: true,
        password: true,
        eduVerified: true,
      },
    });

    // Do not reveal whether an email exists.
    if (!user?.password) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Compare the supplied password with the stored hash.
    const passwordMatches = await bcrypt.compare(
      loginDto.password,
      user.password,
    );

    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // CampusGG requires verified university accounts.
    if (!user.eduVerified) {
      throw new ForbiddenException(
        'Please verify your .edu email before logging in',
      );
    }

    // Sign a JWT containing the authenticated user's ID.
    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
    });

    return {
      access_token: accessToken,
    };
  }
}

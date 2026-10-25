import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';

import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { User } from './user.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard';
import { UpdateProfileDto } from './dto/update-profile.dto';
import {
  ProfileResponseDto,
  PublicProfileDto,
} from './dto/profile-response.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  private sanitizeUser(user: Partial<User>) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { verificationToken, tokenExpiresAt, password, ...safeUser } = user;
    return safeUser;
  }

  @Post()
  async create(@Body() createUserDto: CreateUserDto) {
    const user = await this.usersService.create(createUserDto);
    return this.sanitizeUser(user);
  }

  @Get()
  async findAll() {
    const users = await this.usersService.findAll();
    return users.map((user) => new PublicProfileDto(user));
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async findMe(@Req() request: AuthenticatedRequest) {
    if (!request.user?.id) throw new UnauthorizedException();
    return new ProfileResponseDto(
      await this.usersService.findOne(request.user.id),
    );
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  async updateMe(
    @Req() request: AuthenticatedRequest,
    // Keep the global stripping pipe from removing unknown keys before this strict, route-specific pipe.
    @Body(
      new ValidationPipe({
        expectedType: UpdateProfileDto,
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    )
    body: unknown,
  ) {
    if (!request.user?.id) throw new UnauthorizedException();
    return new ProfileResponseDto(
      await this.usersService.updateProfile(
        request.user.id,
        body as UpdateProfileDto,
      ),
    );
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const user = await this.usersService.findOne(id);
    return new PublicProfileDto(user);
  }
}

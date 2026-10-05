import { Body, Controller, Get, Param, Post } from '@nestjs/common';

import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { User } from './user.entity';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  private sanitizeUser(user: Partial<User>) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { verificationToken, password, ...safeUser } = user;
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
    return users.map((user) => this.sanitizeUser(user));
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const user = await this.usersService.findOne(id);
    return this.sanitizeUser(user);
  }
}

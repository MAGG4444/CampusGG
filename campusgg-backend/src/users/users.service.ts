import { Injectable, NotFoundException } from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { User } from './user.entity';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    const user = this.usersRepository.create(createUserDto);
    return this.usersRepository.save(user);
  }

  async findAll(): Promise<User[]> {
    return this.usersRepository.find();
  }

  async findOne(id: string): Promise<User> {
    const user = await this.usersRepository.findOne({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }

    return user;
  }

  async updateProfile(id: string, dto: UpdateProfileDto): Promise<User> {
    // Update only supplied editable columns. A full entity save could overwrite concurrent changes.
    const changes: UpdateProfileDto = {};
    if (dto.displayName !== undefined) changes.displayName = dto.displayName;
    if (dto.bio !== undefined) changes.bio = dto.bio.trim();
    if (dto.favoriteGames !== undefined)
      changes.favoriteGames = dto.favoriteGames;
    if (dto.skillLevel !== undefined) changes.skillLevel = dto.skillLevel;
    if (Object.keys(changes).length) {
      const result = await this.usersRepository.update(id, changes);
      if (!result.affected) throw new NotFoundException('User not found');
    }
    return this.findOne(id);
  }
}

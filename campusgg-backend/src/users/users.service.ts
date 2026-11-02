import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { User } from './user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

const GAME_OPTIONS: Record<string, { name: string; roles: readonly string[] }> =
  {
    valorant: {
      name: 'Valorant',
      roles: ['Duelist', 'Initiator', 'Controller', 'Sentinel'],
    },
    'league of legends': {
      name: 'League of Legends',
      roles: ['Top', 'Jungle', 'Mid', 'ADC', 'Support'],
    },
    'overwatch 2': {
      name: 'Overwatch 2',
      roles: ['Tank', 'Damage', 'Support'],
    },
  };
const GENERIC_ROLE_OPTIONS = ['Leader', 'Strategist', 'Support', 'Flex'];

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
    await this.findOne(id);
    const changes: Partial<User> = {};

    if (dto.displayName !== undefined) changes.displayName = dto.displayName;
    if (dto.bio !== undefined) changes.bio = dto.bio.trim();
    if (dto.gamingProfiles !== undefined) {
      changes.gamingProfiles = dto.gamingProfiles.map((profile) => {
        const gameKey = profile.game.toLowerCase();
        const knownGame = GAME_OPTIONS[gameKey];
        const allowedRoles = knownGame?.roles ?? GENERIC_ROLE_OPTIONS;
        const canonicalRoles = new Map(
          allowedRoles.map((role) => [role.toLowerCase(), role]),
        );
        const preferredRoles = profile.preferredRoles.map((role) => {
          const canonicalRole = canonicalRoles.get(role.toLowerCase());
          if (!canonicalRole) {
            throw new BadRequestException(
              `Invalid preferred role for ${profile.game}: ${role}`,
            );
          }
          return canonicalRole;
        });
        return {
          game: knownGame?.name ?? profile.game,
          preferredRoles,
          experienceLevel: profile.experienceLevel,
        };
      });
    }

    if (Object.keys(changes).length > 0) {
      const result = await this.usersRepository.update(id, changes);
      if (!result.affected) throw new NotFoundException('User not found');
    }

    return this.findOne(id);
  }
}

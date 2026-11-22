import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';

import { User } from './user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import {
  canonicalRole,
  findGameDefinition,
  findGamingProfile,
} from '../common/games.config';

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
        const game = findGameDefinition(profile.game);
        const preferredRoles = profile.preferredRoles.map((role) => {
          const canonical = canonicalRole(profile.game, role);
          if (!canonical) {
            throw new BadRequestException(
              `Invalid preferred role for ${profile.game}: ${role}`,
            );
          }
          return canonical;
        });
        return {
          game: game?.name ?? profile.game,
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

  /**
   * Public-profile fields for Suggested Users. The caller must not serialize
   * `email`; it exists here only to derive a campus domain.
   */
  async findRecommendationCandidates(
    viewerId: string,
    game?: string,
  ): Promise<User[]> {
    const candidates = await this.usersRepository.find({
      select: {
        id: true,
        username: true,
        displayName: true,
        bio: true,
        email: true,
        eduVerified: true,
        gamingProfiles: true,
        createdAt: true,
        updatedAt: true,
      },
      where: { eduVerified: true, id: Not(viewerId) },
      order: { createdAt: 'DESC' },
      take: 200,
    });
    if (!game) {
      return candidates.filter(
        (candidate) => (candidate.gamingProfiles ?? []).length > 0,
      );
    }
    return candidates.filter((candidate) =>
      findGamingProfile(candidate.gamingProfiles, game),
    );
  }
}

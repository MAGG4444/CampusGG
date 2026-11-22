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
import {
  canonicalRole,
  findGameDefinition,
  gameMatchKeys,
} from '../common/games.config';
import { MAX_RECOMMENDATION_CANDIDATES } from '../recommendations/recommendation.config';

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
    const gameKeys = gameMatchKeys(game);
    if (game && gameKeys.length === 0) return [];

    const query = this.usersRepository
      .createQueryBuilder('user')
      .select([
        'user.id',
        'user.username',
        'user.displayName',
        'user.bio',
        'user.email',
        'user.eduVerified',
        'user.gamingProfiles',
        'user.createdAt',
        'user.updatedAt',
      ])
      .where('user.eduVerified = :eduVerified', { eduVerified: true })
      .andWhere('user.id != :viewerId', { viewerId })
      .orderBy('user.createdAt', 'DESC')
      .take(MAX_RECOMMENDATION_CANDIDATES);

    if (gameKeys.length > 0) {
      query.andWhere(
        `EXISTS (
          SELECT 1
          FROM jsonb_array_elements(user.gaming_profiles) AS profile
          WHERE LOWER(profile->>'game') IN (:...gameKeys)
        )`,
        { gameKeys },
      );
    } else {
      query.andWhere('jsonb_array_length(user.gaming_profiles) > 0');
    }

    return query.getMany();
  }
}

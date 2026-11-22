import {
  MyContentItemDto,
  MyContentPageDto,
  MyContentQueryDto,
} from '../common/dto/my-content.dto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { In, Raw, Repository } from 'typeorm';

import { UsersService } from '../users/users.service';
import {
  canonicalGameName,
  canonicalRole,
  gameMatchKeys,
} from '../common/games.config';
import {
  LOBBY_STALE_HOURS,
  MAX_RECOMMENDATION_CANDIDATES,
} from '../recommendations/recommendation.config';
import { CreateLobbyDto } from './dto/create-lobby.dto';
import { SearchLobbiesDto } from './dto/search-lobbies.dto';
import { Lobby, LobbyVisibility } from './lobby.entity';
import { LobbyMember, LobbyMemberRole } from './lobby-member.entity';
import { User } from '../users/user.entity';

@Injectable()
export class LobbiesService {
  constructor(
    @InjectRepository(Lobby)
    private readonly lobbiesRepository: Repository<Lobby>,
    private readonly usersService: UsersService,
  ) {}

  async findMine(
    userId: string,
    query: MyContentQueryDto,
  ): Promise<MyContentPageDto> {
    const { page, limit } = query;
    // Filter ownership in SQL; no membership/author lookup per result.
    const owned = this.lobbiesRepository
      .createQueryBuilder('lobby')
      .where('lobby.host_id = :userId', { userId });
    const [items, total] = await Promise.all([
      owned
        .clone()
        .select('lobby.id', 'id')
        .addSelect('lobby.lobbyName', 'title')
        .addSelect('LEFT(lobby.details, 240)', 'preview')
        .addSelect('lobby.createdAt', 'createdAt')
        .orderBy('lobby.createdAt', 'DESC')
        .addOrderBy('lobby.id', 'DESC')
        .offset((page - 1) * limit)
        .limit(limit)
        .getRawMany<MyContentItemDto>(),
      owned.getCount(),
    ]);
    return { items, total, page, limit };
  }

  async findMyMemberships(
    userId: string,
  ): Promise<Array<{ lobbyId: string; role: LobbyMemberRole }>> {
    const memberships = await this.lobbiesRepository.manager.find(LobbyMember, {
      where: { user: { id: userId } },
      relations: { lobby: true },
    });
    return memberships.map((membership) => ({
      lobbyId: membership.lobby.id,
      role: membership.role,
    }));
  }

  // ============================================================
  // GET ALL LOBBIES
  // Retrieve lobbies from PostgreSQL with optional filters
  // ============================================================

  async findAll(
    filters: SearchLobbiesDto = {},
    userId?: string,
  ): Promise<Array<Lobby & { memberCount: number }>> {
    const memberships = userId ? await this.findMyMemberships(userId) : [];
    const gameKeys = gameMatchKeys(filters.game);
    const search = {
      ...(gameKeys.length
        ? {
            game: Raw((alias) => `LOWER(${alias}) IN (:...gameKeys)`, {
              gameKeys,
            }),
          }
        : {}),
      ...(filters.skillLevel ? { skillLevel: filters.skillLevel } : {}),
    };
    const lobbies = await this.lobbiesRepository.find({
      relations: { host: true },
      select: {
        id: true,
        lobbyName: true,
        subtitle: true,
        details: true,
        tags: true,
        game: true,
        skillLevel: true,
        neededRoles: true,
        participantLimit: true,
        visibility: true,
        createdAt: true,
        updatedAt: true,
        host: { id: true, username: true },
      },
      where: memberships.length
        ? [
            { ...search, visibility: LobbyVisibility.PUBLIC },
            { ...search, id: In(memberships.map(({ lobbyId }) => lobbyId)) },
          ]
        : { ...search, visibility: LobbyVisibility.PUBLIC },
      order: {
        createdAt: 'DESC',
      },
    });
    if (lobbies.length === 0) return [];
    const counts = await this.lobbiesRepository.manager
      .getRepository(LobbyMember)
      .createQueryBuilder('member')
      .select('member.lobby_id', 'lobbyId')
      .addSelect('COUNT(*)', 'count')
      .where('member.lobby_id IN (:...lobbyIds)', {
        lobbyIds: lobbies.map(({ id }) => id),
      })
      .groupBy('member.lobby_id')
      .getRawMany<{ lobbyId: string; count: string }>();
    const byLobby = new Map(
      counts.map(({ lobbyId, count }) => [lobbyId, Number(count)]),
    );
    return lobbies.map((lobby) => ({
      ...lobby,
      memberCount: byLobby.get(lobby.id) ?? 0,
    }));
  }

  // ============================================================
  // RECOMMENDATION CANDIDATES
  // Public, joinable lobbies for the recommendation scorer.
  // ============================================================

  async findRecommendationCandidates(
    viewerId: string,
    game?: string,
  ): Promise<Array<Lobby & { memberCount: number }>> {
    const gameKeys = gameMatchKeys(game);
    if (game && gameKeys.length === 0) return [];

    const staleBefore = new Date(
      Date.now() - LOBBY_STALE_HOURS * 60 * 60 * 1000,
    );
    const query = this.lobbiesRepository
      .createQueryBuilder('lobby')
      .leftJoinAndSelect('lobby.host', 'host')
      .select([
        'lobby.id',
        'lobby.lobbyName',
        'lobby.subtitle',
        'lobby.details',
        'lobby.tags',
        'lobby.game',
        'lobby.skillLevel',
        'lobby.neededRoles',
        'lobby.participantLimit',
        'lobby.visibility',
        'lobby.createdAt',
        'lobby.updatedAt',
        'host.id',
        'host.username',
        'host.email',
        'host.gamingProfiles',
      ])
      .where('lobby.visibility = :visibility', {
        visibility: LobbyVisibility.PUBLIC,
      })
      .andWhere('lobby.updatedAt >= :staleBefore', { staleBefore })
      .orderBy('lobby.updatedAt', 'DESC')
      .take(MAX_RECOMMENDATION_CANDIDATES);

    if (gameKeys.length > 0) {
      query.andWhere('LOWER(lobby.game) IN (:...gameKeys)', { gameKeys });
    }

    const lobbies = await query.getMany();
    if (lobbies.length === 0) return [];

    const counts = await this.lobbiesRepository.manager
      .getRepository(LobbyMember)
      .createQueryBuilder('member')
      .select('member.lobby_id', 'lobbyId')
      .addSelect('COUNT(*)', 'count')
      .where('member.lobby_id IN (:...lobbyIds)', {
        lobbyIds: lobbies.map(({ id }) => id),
      })
      .groupBy('member.lobby_id')
      .getRawMany<{ lobbyId: string; count: string }>();
    const byLobby = new Map(
      counts.map(({ lobbyId, count }) => [lobbyId, Number(count)]),
    );

    return lobbies
      .map((lobby) => ({
        ...lobby,
        memberCount: byLobby.get(lobby.id) ?? 0,
      }))
      .filter(
        (lobby) =>
          lobby.host.id !== viewerId &&
          (lobby.participantLimit == null ||
            lobby.memberCount < lobby.participantLimit),
      );
  }

  /** The lobby the user currently belongs to, if any. */
  async findCurrentLobbyId(userId: string): Promise<string | null> {
    const membership = await this.lobbiesRepository.manager.findOne(
      LobbyMember,
      {
        where: { user: { id: userId } },
        relations: { lobby: true },
      },
    );
    return membership?.lobby.id ?? null;
  }

  // ============================================================
  // GET LOBBY BY ID
  // Retrieve a specific lobby using its UUID
  // ============================================================

  async findOne(id: string): Promise<Lobby> {
    const lobby = await this.lobbiesRepository.findOne({
      where: { id },
    });

    if (!lobby) {
      throw new NotFoundException(`Lobby ${id} not found`);
    }

    return lobby;
  }

  // ============================================================
  // CREATE LOBBY
  // Create a lobby and automatically register its host
  // ============================================================

  async create(
    createLobbyDto: CreateLobbyDto,
    hostUserId: string,
  ): Promise<Lobby> {
    // Verify that the hosting user exists
    const host = await this.usersService.findOne(hostUserId);
    const gameInput = createLobbyDto.game?.trim();
    const game = gameInput ? canonicalGameName(gameInput) : null;
    const neededRoles = (createLobbyDto.neededRoles ?? []).map((role) => {
      const canonical = canonicalRole(game, role);
      if (!canonical) {
        throw new BadRequestException(
          `Invalid needed role for ${game ?? 'this lobby'}: ${role}`,
        );
      }
      return canonical;
    });

    // Create lobby and host membership in one transaction
    return this.lobbiesRepository.manager.transaction(async (manager) => {
      await manager.findOneOrFail(User, {
        where: { id: hostUserId },
        lock: { mode: 'pessimistic_write' },
      });
      if (
        await manager.findOne(LobbyMember, {
          where: { user: { id: hostUserId } },
        })
      ) {
        throw new ConflictException('You already belong to an active lobby.');
      }
      // Construct the lobby entity
      const lobby = manager.create(Lobby, {
        lobbyName: createLobbyDto.lobbyName,
        subtitle: createLobbyDto.subtitle ?? null,
        details: createLobbyDto.details,
        tags: createLobbyDto.tags ?? [],
        game,
        skillLevel: createLobbyDto.skillLevel ?? null,
        neededRoles,
        participantLimit: createLobbyDto.participantLimit ?? null,
        visibility: createLobbyDto.visibility ?? LobbyVisibility.PUBLIC,
        host,
      });

      // Save the lobby to PostgreSQL
      const savedLobby = await manager.save(Lobby, lobby);

      // Automatically register the host as a participant
      const hostMembership = manager.create(LobbyMember, {
        lobby: savedLobby,
        user: host,
        role: LobbyMemberRole.HOST,
      });

      // Save the host membership
      await manager.save(LobbyMember, hostMembership);

      return savedLobby;
    });
  }

  async isMember(lobbyId: string, userId: string): Promise<boolean> {
    return !!(await this.lobbiesRepository.manager.findOne(LobbyMember, {
      where: { lobby: { id: lobbyId }, user: { id: userId } },
    }));
  }

  // ============================================================
  // JOIN LOBBY
  // Add a user to an existing public lobby
  // ============================================================

  async joinLobby(lobbyId: string, userId: string): Promise<void> {
    // Verify that the user exists
    const user = await this.usersService.findOne(userId);

    // Use a transaction to prevent concurrent join issues
    await this.lobbiesRepository.manager.transaction(async (manager) => {
      await manager.findOneOrFail(User, {
        where: { id: userId },
        lock: { mode: 'pessimistic_write' },
      });
      // Lock the lobby row while checking membership and capacity
      const lobby = await manager.findOne(Lobby, {
        where: { id: lobbyId },
        lock: { mode: 'pessimistic_write' },
      });

      // Check if the lobby exists
      if (!lobby) {
        throw new NotFoundException('Lobby not found');
      }

      // Only allow joining public lobbies for now
      if (lobby.visibility !== LobbyVisibility.PUBLIC) {
        throw new ForbiddenException('This lobby requires an invitation');
      }

      // Check if the user is already a member
      const existingMembership = await manager.findOne(LobbyMember, {
        where: {
          user: { id: userId },
        },
      });

      if (existingMembership) {
        throw new ConflictException('You already belong to an active lobby.');
      }

      // Count all existing participants, including the host
      const memberCount = await manager.count(LobbyMember, {
        where: {
          lobby: { id: lobbyId },
        },
      });

      // Prevent joining if the lobby is full
      if (
        lobby.participantLimit != null &&
        memberCount >= lobby.participantLimit
      ) {
        throw new ConflictException('Lobby is full');
      }

      // Create the new membership
      const membership = manager.create(LobbyMember, {
        lobby,
        user,
        role: LobbyMemberRole.MEMBER,
      });

      // Save membership to PostgreSQL
      await manager.save(LobbyMember, membership);
    });
  }

  // ============================================================
  // LEAVE LOBBY
  // Remove an existing member from a lobby
  // ============================================================

  async leaveLobby(lobbyId: string, userId: string): Promise<void> {
    await this.lobbiesRepository.manager.transaction(async (manager) => {
      // Lock the lobby to synchronize membership changes
      const lobby = await manager.findOne(Lobby, {
        where: { id: lobbyId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!lobby) {
        throw new NotFoundException('Lobby not found');
      }

      // Find the user's existing membership
      const membership = await manager.findOne(LobbyMember, {
        where: {
          lobby: { id: lobbyId },
          user: { id: userId },
        },
      });

      if (!membership) {
        throw new NotFoundException('User is not a member of this lobby');
      }

      if (membership.role === LobbyMemberRole.HOST) {
        const next = await manager.findOne(LobbyMember, {
          where: { lobby: { id: lobbyId }, role: LobbyMemberRole.MEMBER },
          relations: { user: true },
          order: { joinedAt: 'ASC', id: 'ASC' },
        });
        if (!next) {
          await manager.remove(Lobby, lobby);
          return;
        }
        next.role = LobbyMemberRole.HOST;
        lobby.host = next.user;
        await manager.save(LobbyMember, next);
        await manager.save(Lobby, lobby);
      }

      // Remove the user's membership from PostgreSQL
      await manager.remove(LobbyMember, membership);
    });
  }

  async deleteLobby(lobbyId: string, userId: string): Promise<void> {
    await this.lobbiesRepository.manager.transaction(async (manager) => {
      const lobby = await manager.findOne(Lobby, {
        where: { id: lobbyId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!lobby) throw new NotFoundException('Lobby not found');
      const membership = await manager.findOne(LobbyMember, {
        where: {
          lobby: { id: lobbyId },
          user: { id: userId },
          role: LobbyMemberRole.HOST,
        },
      });
      if (!membership)
        throw new ForbiddenException(
          'Only the current host can delete this lobby',
        );
      await manager.remove(Lobby, lobby);
    });
  }

  // Retrieve the actual participants of a lobby.
  async findMembers(lobbyId: string): Promise<
    Array<{
      id: string;
      username: string;
      role: LobbyMemberRole;
    }>
  > {
    // Preserve our existing 404 behavior.
    await this.findOne(lobbyId);

    const memberships = await this.lobbiesRepository.manager
      .getRepository(LobbyMember)
      .find({
        where: {
          lobby: { id: lobbyId },
        },
        relations: {
          user: true,
        },
        order: {
          joinedAt: 'ASC',
        },
      });

    // Return only information needed by the frontend.
    return memberships.map((membership) => ({
      id: membership.user.id,
      username: membership.user.username,
      role: membership.role,
    }));
  }
}

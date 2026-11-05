import {
  MyContentItemDto,
  MyContentPageDto,
  MyContentQueryDto,
} from '../common/dto/my-content.dto';
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { UsersService } from '../users/users.service';
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

  // ============================================================
  // GET ALL LOBBIES
  // Retrieve lobbies from PostgreSQL with optional filters
  // ============================================================

  async findAll(filters: SearchLobbiesDto = {}): Promise<Lobby[]> {
    return this.lobbiesRepository.find({
      where: {
        ...(filters.game ? { game: filters.game } : {}),
        ...(filters.skillLevel ? { skillLevel: filters.skillLevel } : {}),
      },
      order: {
        createdAt: 'DESC',
      },
    });
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
        game: createLobbyDto.game ?? null,
        skillLevel: createLobbyDto.skillLevel ?? null,
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

  /** Create a matched lobby and every required membership in one transaction. */
  async createMatchedLobby(
    dto: CreateLobbyDto,
    userIds: readonly string[],
  ): Promise<Lobby> {
    if (!userIds.length || new Set(userIds).size !== userIds.length) {
      throw new ConflictException('A match must contain distinct players.');
    }

    return this.lobbiesRepository.manager.transaction(async (manager) => {
      const users = new Map<string, User>();
      // Match the lock order used by batch enrollment to avoid deadlocks.
      for (const id of [...userIds].sort()) {
        const user = await manager.findOneOrFail(User, {
          where: { id },
          lock: { mode: 'pessimistic_write' },
        });
        users.set(id, user);
      }
      for (const id of userIds) {
        if (await manager.findOne(LobbyMember, { where: { user: { id } } })) {
          throw new ConflictException(
            'A player already belongs to an active lobby.',
          );
        }
      }

      const lobby = manager.create(Lobby, {
        lobbyName: dto.lobbyName,
        subtitle: dto.subtitle ?? null,
        details: dto.details,
        tags: dto.tags ?? [],
        game: dto.game ?? null,
        skillLevel: dto.skillLevel ?? null,
        participantLimit: dto.participantLimit ?? null,
        visibility: dto.visibility ?? LobbyVisibility.PUBLIC,
        host: users.get(userIds[0])!,
      });
      const savedLobby = await manager.save(Lobby, lobby);
      for (const [index, id] of userIds.entries()) {
        await manager.save(
          LobbyMember,
          manager.create(LobbyMember, {
            lobby: savedLobby,
            user: users.get(id)!,
            role: index === 0 ? LobbyMemberRole.HOST : LobbyMemberRole.MEMBER,
          }),
        );
      }
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

  // ============================================================
  // ADD MEMBERS (batch)
  // Add multiple users to a lobby as members.
  // Used by the matchmaking service to populate a lobby from a MatchGroup.
  // ============================================================

  async addMembers(lobbyId: string, userIds: string[]): Promise<void> {
    return this.lobbiesRepository.manager.transaction(async (manager) => {
      for (const userId of [...new Set(userIds)].sort()) {
        await manager.findOneOrFail(User, {
          where: { id: userId },
          lock: { mode: 'pessimistic_write' },
        });
      }
      const lobby = await manager.findOne(Lobby, {
        where: { id: lobbyId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!lobby) {
        throw new NotFoundException(`Lobby ${lobbyId} not found`);
      }

      for (const userId of userIds) {
        const user = await this.usersService.findOne(userId);

        const existing = await manager.findOne(LobbyMember, {
          where: {
            lobby: { id: lobbyId },
            user: { id: userId },
          },
        });

        if (existing) {
          continue;
        }

        if (
          await manager.findOne(LobbyMember, {
            where: { user: { id: userId } },
          })
        ) {
          throw new ConflictException(
            'A player already belongs to an active lobby.',
          );
        }

        const membership = manager.create(LobbyMember, {
          lobby,
          user,
          role: LobbyMemberRole.MEMBER,
        });

        await manager.save(LobbyMember, membership);
      }
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

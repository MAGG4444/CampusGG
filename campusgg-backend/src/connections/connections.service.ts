import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { Connection, type Relationship } from './connection.entity';
import { recentPlayersSql, type RecentPlayer } from './recent-players';

export function connectionPairKey(a: string, b: string): string {
  return [a.toLowerCase(), b.toLowerCase()].sort().join(':');
}

export function relationshipFor(
  viewerId: string,
  connection: Connection | null | undefined,
): Relationship {
  if (!connection) return 'none';
  if (
    connection.requesterId !== viewerId &&
    connection.recipientId !== viewerId
  ) {
    return 'none';
  }
  if (connection.status === 'accepted') return 'friend';
  return connection.requesterId === viewerId ? 'outgoing' : 'incoming';
}

@Injectable()
export class ConnectionsService {
  constructor(
    @InjectRepository(Connection)
    private readonly connections: Repository<Connection>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

  private async requireViewer(viewerId: string): Promise<string> {
    const id = viewerId.toLowerCase();
    const user = await this.users.findOneBy({ id, eduVerified: true });
    if (!user) throw new ForbiddenException('A verified account is required.');
    return user.id;
  }

  private async requireTarget(
    viewerId: string,
    targetId: string,
  ): Promise<User> {
    const id = targetId.toLowerCase();
    if (id === viewerId) {
      throw new BadRequestException('You cannot connect with yourself.');
    }
    const target = await this.users.findOneBy({ id, eduVerified: true });
    if (!target) throw new NotFoundException('Player not found.');
    return target;
  }

  // Explicit public-field allowlist: never serialize User entities directly.
  private publicPerson(user: User, relationship: Relationship) {
    const profile = user.gamingProfiles?.[0];
    return {
      id: user.id,
      username: user.username,
      name: user.displayName || user.username,
      displayName: user.displayName || user.username,
      bio: user.bio ?? '',
      game: profile?.game ?? null,
      experienceLevel: profile?.experienceLevel ?? null,
      relationship,
    };
  }

  async recent(viewer: string): Promise<{ items: RecentPlayer[] }> {
    const viewerId = await this.requireViewer(viewer);
    const connection = this.users.manager.connection;
    const schema =
      (connection.options as { schema?: string }).schema ??
      process.env.DATABASE_SCHEMA ??
      'public';
    const items = await this.users.manager.query<RecentPlayer[]>(
      recentPlayersSql(connection.driver.escape(schema)),
      [viewerId],
    );
    return { items };
  }

  async list(viewer: string, kind: 'friend' | 'incoming' | 'outgoing') {
    const viewerId = await this.requireViewer(viewer);
    const where =
      kind === 'friend'
        ? [
            { requesterId: viewerId, status: 'accepted' as const },
            { recipientId: viewerId, status: 'accepted' as const },
          ]
        : kind === 'incoming'
          ? [{ recipientId: viewerId, status: 'pending' as const }]
          : [{ requesterId: viewerId, status: 'pending' as const }];
    const rows = await this.connections.find({
      where,
      relations: { requester: true, recipient: true },
      order: { updatedAt: 'DESC', id: 'ASC' },
    });
    return {
      items: rows.flatMap((row) => {
        const other =
          row.requesterId === viewerId ? row.recipient : row.requester;
        if (!other?.eduVerified) return [];
        return [
          {
            ...this.publicPerson(other, kind),
            connectionId: row.id,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
          },
        ];
      }),
    };
  }

  async status(viewer: string, targetId: string) {
    const viewerId = await this.requireViewer(viewer);
    const target = await this.requireTarget(viewerId, targetId);
    const row = await this.connections.findOneBy({
      pairKey: connectionPairKey(viewerId, target.id),
    });
    return { userId: target.id, relationship: relationshipFor(viewerId, row) };
  }

  async request(viewer: string, targetId: string) {
    const viewerId = await this.requireViewer(viewer);
    const target = await this.requireTarget(viewerId, targetId);
    // INSERT rather than save/upsert: never overwrite the other user's request.
    // The unique canonical pair also protects against simultaneous requests.
    try {
      await this.connections.insert({
        requesterId: viewerId,
        recipientId: target.id,
        pairKey: connectionPairKey(viewerId, target.id),
        status: 'pending',
      });
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === '23505'
      ) {
        throw new ConflictException('A connection or request already exists.');
      }
      throw error;
    }
    return { userId: target.id, relationship: 'outgoing' as const };
  }

  async accept(viewer: string, targetId: string) {
    const viewerId = await this.requireViewer(viewer);
    const target = await this.requireTarget(viewerId, targetId);
    const result = await this.connections.update(
      { requesterId: target.id, recipientId: viewerId, status: 'pending' },
      { status: 'accepted' },
    );
    if (!result.affected)
      throw new NotFoundException('Incoming request not found.');
    return { userId: target.id, relationship: 'friend' as const };
  }

  async decline(viewer: string, targetId: string) {
    const viewerId = await this.requireViewer(viewer);
    const target = await this.requireTarget(viewerId, targetId);
    const result = await this.connections.delete({
      requesterId: target.id,
      recipientId: viewerId,
      status: 'pending',
    });
    if (!result.affected)
      throw new NotFoundException('Incoming request not found.');
    return { userId: target.id, relationship: 'none' as const };
  }

  async cancel(viewer: string, targetId: string) {
    const viewerId = await this.requireViewer(viewer);
    const target = await this.requireTarget(viewerId, targetId);
    const result = await this.connections.delete({
      requesterId: viewerId,
      recipientId: target.id,
      status: 'pending',
    });
    if (!result.affected)
      throw new NotFoundException('Outgoing request not found.');
    return { userId: target.id, relationship: 'none' as const };
  }

  async remove(viewer: string, targetId: string) {
    const viewerId = await this.requireViewer(viewer);
    const target = await this.requireTarget(viewerId, targetId);
    const result = await this.connections.delete({
      pairKey: connectionPairKey(viewerId, target.id),
      status: 'accepted',
    });
    if (!result.affected) throw new NotFoundException('Friendship not found.');
    return { userId: target.id, relationship: 'none' as const };
  }

  async search(viewer: string, query: string) {
    const viewerId = await this.requireViewer(viewer);
    const q = query.trim();
    if (q.length < 2 || q.length > 100) {
      throw new BadRequestException('Search must contain 2 to 100 characters.');
    }
    // Literal substring matching, parameterized; no email search or wildcards.
    const people = await this.users
      .createQueryBuilder('u')
      .where('u.edu_verified = true AND u.id <> :viewerId', { viewerId })
      .andWhere(
        "(strpos(lower(u.username), lower(:q)) > 0 OR strpos(lower(coalesce(u.display_name, '')), lower(:q)) > 0)",
        { q },
      )
      .orderBy('u.username', 'ASC')
      .addOrderBy('u.id', 'ASC')
      .take(30)
      .getMany();
    if (!people.length) return { items: [] };
    const rows = await this.connections.findBy({
      pairKey: In(
        people.map((person) => connectionPairKey(viewerId, person.id)),
      ),
    });
    const byPair = new Map(rows.map((row) => [row.pairKey, row]));
    return {
      items: people.map((person) =>
        this.publicPerson(
          person,
          relationshipFor(
            viewerId,
            byPair.get(connectionPairKey(viewerId, person.id)),
          ),
        ),
      ),
    };
  }
}

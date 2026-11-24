import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { Connection } from '../connections/connection.entity';
import { connectionPairKey } from '../connections/connections.service';
import { User } from '../users/user.entity';
import { DirectMessage } from './direct-message.entity';

function messageDto(row: DirectMessage) {
  return {
    id: row.id,
    senderId: row.senderId,
    recipientId: row.recipientId,
    content: row.content,
    createdAt: row.createdAt,
    readAt: row.readAt,
  };
}

@Injectable()
export class DirectMessagesService {
  constructor(private readonly dataSource: DataSource) {}

  private async requireViewer(
    manager: EntityManager,
    viewer: string,
  ): Promise<string> {
    const user = await manager
      .getRepository(User)
      .findOneBy({ id: viewer.toLowerCase(), eduVerified: true });
    if (!user) throw new ForbiddenException('A verified account is required.');
    return user.id;
  }

  // Lock the accepted connection until each conversation operation completes.
  // Removing a friendship cannot race a send past this authorization check.
  private async withFriend<T>(
    viewer: string,
    target: string,
    operation: (
      manager: EntityManager,
      viewerId: string,
      targetId: string,
      pair: string,
    ) => Promise<T>,
  ): Promise<T> {
    return this.dataSource.transaction(async (manager) => {
      const viewerId = await this.requireViewer(manager, viewer);
      const targetId = target.toLowerCase();
      if (viewerId === targetId)
        throw new BadRequestException('You cannot message yourself.');
      const pair = connectionPairKey(viewerId, targetId);
      const connection = await manager.getRepository(Connection).findOne({
        where: { pairKey: pair, status: 'accepted' },
        lock: { mode: 'pessimistic_read' },
      });
      if (!connection)
        throw new ForbiddenException('You can only message accepted friends.');
      const friend = await manager
        .getRepository(User)
        .findOneBy({ id: targetId, eduVerified: true });
      if (!friend) throw new NotFoundException('Player not found.');
      return operation(manager, viewerId, targetId, pair);
    });
  }

  async list(viewer: string) {
    return this.dataSource.transaction(async (manager) => {
      const viewerId = await this.requireViewer(manager, viewer);
      // One query; the lateral joins return only the latest message and unread count.
      const schema = this.dataSource.driver.escape(
        (this.dataSource.options as { schema?: string }).schema ?? 'public',
      );
      const rows = (await manager.query(
        `SELECT u.id AS "id", u.username, coalesce(nullif(u.display_name, ''), u.username) AS "displayName", u.bio,
        latest.id AS "messageId", latest.sender_id AS "senderId", latest.recipient_id AS "recipientId", latest.content, latest.created_at AS "createdAt", latest.read_at AS "readAt",
        unread.count AS "unreadCount"
        FROM ${schema}.connections c
        JOIN ${schema}.users u ON u.id = CASE WHEN c.requester_id = $1 THEN c.recipient_id ELSE c.requester_id END
        JOIN LATERAL (SELECT m.* FROM ${schema}.direct_messages m WHERE m.pair_key = c.pair_key ORDER BY m.created_at DESC, m.id DESC LIMIT 1) latest ON true
        CROSS JOIN LATERAL (SELECT count(*)::int AS count FROM ${schema}.direct_messages m WHERE m.pair_key = c.pair_key AND m.recipient_id = $1 AND m.read_at IS NULL) unread
        WHERE c.status = 'accepted' AND (c.requester_id = $1 OR c.recipient_id = $1) AND u.edu_verified = true
        ORDER BY latest.created_at DESC, latest.id DESC`,
        [viewerId],
      )) as Array<{
        id: string;
        username: string;
        displayName: string;
        bio: string;
        messageId: string;
        senderId: string;
        recipientId: string;
        content: string;
        createdAt: Date;
        readAt: Date | null;
        unreadCount: number;
      }>;
      return {
        items: rows.map((row) => ({
          id: row.id,
          user: {
            id: row.id,
            username: row.username,
            displayName: row.displayName,
            bio: row.bio,
          },
          lastMessage: {
            id: row.messageId,
            senderId: row.senderId,
            recipientId: row.recipientId,
            content: row.content,
            createdAt: row.createdAt,
            readAt: row.readAt,
          },
          unreadCount: row.unreadCount,
        })),
      };
    });
  }

  async history(viewer: string, target: string, limit = 50, before?: string) {
    return this.withFriend(
      viewer,
      target,
      async (manager, _viewer, _target, pair) => {
        const repo = manager.getRepository(DirectMessage);
        const qb = repo
          .createQueryBuilder('m')
          .where('m.pair_key = :pair', { pair });
        if (before) {
          // Use the database timestamp directly, retaining its microsecond precision.
          const anchor = await repo.findOneBy({ id: before, pairKey: pair });
          if (!anchor) throw new NotFoundException('Message cursor not found.');
          const subquery = qb
            .subQuery()
            .select('a.created_at, a.id')
            .from(DirectMessage, 'a')
            .where('a.id = :before AND a.pair_key = :pair')
            .getQuery();
          qb.andWhere(`(m.created_at, m.id) < ${subquery}`, { before });
        }
        const rows = await qb
          .orderBy('m.created_at', 'DESC')
          .addOrderBy('m.id', 'DESC')
          .take(limit + 1)
          .getMany();
        const page = rows.slice(0, limit);
        return {
          items: page.map(messageDto).reverse(),
          nextBefore: rows.length > limit ? page[page.length - 1].id : null,
        };
      },
    );
  }

  async send(viewer: string, target: string, content: string) {
    const trimmed = content.trim();
    if (!trimmed || trimmed.length > 2000 || trimmed.includes('\0'))
      throw new BadRequestException(
        'Message must contain 1 to 2000 characters.',
      );
    return this.withFriend(
      viewer,
      target,
      async (manager, viewerId, targetId, pair) => {
        const repo = manager.getRepository(DirectMessage);
        const message = await repo.save(
          repo.create({
            senderId: viewerId,
            recipientId: targetId,
            pairKey: pair,
            content: trimmed,
            readAt: null,
          }),
        );
        return messageDto(message);
      },
    );
  }

  async markRead(viewer: string, target: string, messageIds: string[]) {
    return this.withFriend(
      viewer,
      target,
      async (manager, viewerId, targetId, pair) => {
        const result = await manager
          .getRepository(DirectMessage)
          .createQueryBuilder()
          .update(DirectMessage)
          .set({ readAt: () => 'CURRENT_TIMESTAMP' })
          .where(
            'pair_key = :pair AND recipient_id = :viewerId AND sender_id = :targetId AND read_at IS NULL',
            { pair, viewerId, targetId },
          )
          .andWhere('id IN (:...messageIds)', {
            messageIds: [...new Set(messageIds)],
          })
          .execute();
        return { updated: result.affected ?? 0 };
      },
    );
  }
}

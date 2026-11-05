import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Lobby } from './lobby.entity';
import { LobbyMember } from './lobby-member.entity';
import { LobbyMessage } from './lobby-message.entity';

@Injectable()
export class LobbyChatService {
  constructor(
    @InjectRepository(Lobby) private readonly lobbies: Repository<Lobby>,
  ) {}

  private async withMembership<T>(
    lobbyId: string,
    userId: string,
    operation: (manager: typeof this.lobbies.manager) => Promise<T>,
  ): Promise<T> {
    return this.lobbies.manager.transaction(async (manager) => {
      const lobby = await manager.findOne(Lobby, {
        where: { id: lobbyId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!lobby) throw new NotFoundException('Lobby not found');
      const member = await manager.findOne(LobbyMember, {
        where: { lobby: { id: lobbyId }, user: { id: userId } },
      });
      if (!member) throw new ForbiddenException('Lobby membership required');
      return operation(manager);
    });
  }

  async list(lobbyId: string, userId: string) {
    return this.withMembership(lobbyId, userId, async (manager) => {
      const messages = await manager.find(LobbyMessage, {
        where: { lobby: { id: lobbyId } },
        relations: { sender: true },
        order: { createdAt: 'ASC', id: 'ASC' },
      });
      return messages.map((message) => this.toResponse(message));
    });
  }

  async send(lobbyId: string, userId: string, content: string) {
    return this.withMembership(lobbyId, userId, async (manager) => {
      const message = manager.create(LobbyMessage, {
        lobby: { id: lobbyId },
        sender: { id: userId },
        content: content.trim(),
      });
      const saved = await manager.save(LobbyMessage, message);
      const result = await manager.findOneOrFail(LobbyMessage, {
        where: { id: saved.id },
        relations: { sender: true },
      });
      return this.toResponse(result);
    });
  }

  async readState(lobbyId: string, userId: string) {
    return this.withMembership(lobbyId, userId, async (manager) => {
      const member = await manager.findOneOrFail(LobbyMember, {
        where: { lobby: { id: lobbyId }, user: { id: userId } },
      });
      const schema = manager.connection.driver.escape(
        (manager.connection.options as { schema?: string }).schema || 'public',
      );
      const unread = await manager.query<Array<{ id: string }>>(
        `SELECT message.id FROM ${schema}."lobby_messages" message
        JOIN ${schema}."lobby_members" member ON member.id = $3
        WHERE message.lobby_id = $1 AND message.sender_id != $2
          AND (message.created_at, message.id) > (COALESCE(member.last_read_at, member.joined_at), COALESCE(member.last_read_message_id, '00000000-0000-0000-0000-000000000000'::uuid))
        ORDER BY message.created_at ASC, message.id ASC`,
        [lobbyId, userId, member.id],
      );
      return { unreadMessageIds: unread.map((item) => item.id) };
    });
  }

  async markRead(lobbyId: string, userId: string, messageId: string) {
    return this.withMembership(lobbyId, userId, async (manager) => {
      const target = await manager.findOne(LobbyMessage, {
        where: { id: messageId, lobby: { id: lobbyId } },
      });
      if (!target) throw new NotFoundException('Message not found');
      const schema = manager.connection.driver.escape(
        (manager.connection.options as { schema?: string }).schema || 'public',
      );
      await manager.query(
        `UPDATE ${schema}."lobby_members" member SET last_read_message_id = $1,
          last_read_at = (SELECT candidate.created_at FROM ${schema}."lobby_messages" candidate WHERE candidate.id = $1 AND candidate.lobby_id = $2)
        WHERE member.lobby_id = $2 AND member.user_id = $3
          AND (SELECT ROW(candidate.created_at, candidate.id) FROM ${schema}."lobby_messages" candidate WHERE candidate.id = $1 AND candidate.lobby_id = $2)
            > ROW(COALESCE(member.last_read_at, member.joined_at),
              COALESCE(member.last_read_message_id, '00000000-0000-0000-0000-000000000000'::uuid))`,
        [messageId, lobbyId, userId],
      );
      return { success: true };
    });
  }

  private toResponse(message: LobbyMessage) {
    return {
      id: message.id,
      content: message.content,
      createdAt: message.createdAt,
      sender: {
        id: message.sender.id,
        username: message.sender.username,
        displayName: message.sender.displayName,
      },
    };
  }
}

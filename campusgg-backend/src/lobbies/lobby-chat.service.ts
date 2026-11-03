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

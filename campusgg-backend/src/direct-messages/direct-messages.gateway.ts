import { Logger, OnModuleDestroy } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { isUUID } from 'class-validator';
import type { Namespace, Socket } from 'socket.io';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { DirectMessageEvents } from './direct-message-events';
import { PresenceService } from '../presence/presence.service';

const room = (id: string) => `direct-user:${id.toLowerCase()}`;

@WebSocketGateway({ namespace: '/direct-messages', cors: { origin: '*' } })
export class DirectMessagesGateway
  implements
    OnGatewayInit,
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnModuleDestroy
{
  @WebSocketServer()
  server!: Namespace;

  private readonly logger = new Logger(DirectMessagesGateway.name);
  private readonly timers = new Map<Socket, ReturnType<typeof setTimeout>>();
  private unsubscribe?: () => void;

  constructor(
    private readonly jwt: JwtService,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly events: DirectMessageEvents,
    private readonly presence: PresenceService,
  ) {}

  afterInit(): void {
    this.unsubscribe = this.events.subscribe((users) => {
      // Never broadcast message text or user IDs. The authenticated REST API
      // independently checks friendship and account status on every refresh.
      this.server.to(users.map(room)).emit('direct-messages:changed');
    });
  }

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token: unknown = client.handshake.auth.token;
      if (typeof token !== 'string' || !token) throw new Error('Missing token');
      const payload =
        await this.jwt.verifyAsync<Record<string, unknown>>(token);
      const { sub, exp } = payload;
      if (
        typeof sub !== 'string' ||
        !isUUID(sub) ||
        typeof exp !== 'number' ||
        !Number.isFinite(exp)
      )
        throw new Error('Invalid token');
      const user = await this.users.findOneBy({
        id: sub.toLowerCase(),
        eduVerified: true,
      });
      const remaining = exp * 1000 - Date.now();
      if (
        !user ||
        remaining <= 0 ||
        remaining > 2_147_483_647 ||
        !client.connected
      )
        throw new Error('Invalid session');
      await client.join(room(user.id));
      if (!client.connected) return;
      this.timers.set(
        client,
        setTimeout(() => client.disconnect(true), remaining),
      );
      this.presence.attach(client.id, user.id);
      client.emit('direct-messages:ready');
    } catch {
      // Do not echo tokens or database details back to a client.
      if (client.connected) client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    this.presence.detach(client.id);
    const timer = this.timers.get(client);
    if (timer) clearTimeout(timer);
    this.timers.delete(client);
  }

  onModuleDestroy(): void {
    this.unsubscribe?.();
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
    this.logger.debug('Direct message notification gateway stopped');
  }
}

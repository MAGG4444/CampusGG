import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Connection } from '../connections/connection.entity';
import { User } from '../users/user.entity';
import { DirectMessage } from './direct-message.entity';
import { DirectMessagesController } from './direct-messages.controller';
import { DirectMessagesService } from './direct-messages.service';
import { DirectMessageEvents } from './direct-message-events';
import { DirectMessagesGateway } from './direct-messages.gateway';
import { ConnectionsModule } from '../connections/connections.module';
import { PresenceService } from '../presence/presence.service';
import { PresenceController } from '../presence/presence.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([DirectMessage, Connection, User]),
    AuthModule,
    ConnectionsModule,
  ],
  controllers: [DirectMessagesController, PresenceController],
  providers: [
    DirectMessagesService,
    DirectMessageEvents,
    DirectMessagesGateway,
    PresenceService,
  ],
  exports: [DirectMessagesService],
})
export class DirectMessagesModule {}

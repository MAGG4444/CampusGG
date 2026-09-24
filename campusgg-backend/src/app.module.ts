import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LobbiesController } from './lobbies/lobbies.controller';
import { RedisModule } from './redis/redis.module';
import { EventsGateway } from './events/events.gateway';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    RedisModule,
  ],
  controllers: [AppController, LobbiesController],
  providers: [AppService, EventsGateway],
})
export class AppModule {}
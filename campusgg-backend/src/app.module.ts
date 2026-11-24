import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LobbiesModule } from './lobbies/lobbies.module';
import { RecommendationsModule } from './recommendations/recommendations.module';

import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { RedisModule } from './redis/redis.module';
import { DatabaseController } from './database/database.controller';
import { ForumModule } from './forum/forum.module';
import { SteamModule } from './steam/steam.module';
import { ConnectionsModule } from './connections/connections.module';
import { DirectMessagesModule } from './direct-messages/direct-messages.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        url: configService.getOrThrow<string>('DATABASE_URL'),

        autoLoadEntities: true,

        synchronize: configService.get<string>('NODE_ENV') !== 'production',
      }),
    }),

    UsersModule,
    AuthModule,
    RedisModule,
    LobbiesModule,
    RecommendationsModule,
    ForumModule,
    SteamModule,
    ConnectionsModule,
    DirectMessagesModule,
  ],

  controllers: [AppController, DatabaseController],

  providers: [AppService],
})
export class AppModule {}

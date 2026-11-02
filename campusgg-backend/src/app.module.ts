import { join } from 'node:path';

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import {
  resolveConnectionTimeout,
  resolveDatabasePoolSize,
  resolveDatabaseSsl,
  resolveIdleTimeout,
} from './database/database-options';
import { LobbiesModule } from './lobbies/lobbies.module';
import { MatchmakingModule } from './matchmaking/matchmaking.module';

import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { RedisModule } from './redis/redis.module';
import { DatabaseController } from './database/database.controller';
import { ForumModule } from './forum/forum.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres' as const,
        url: configService.getOrThrow<string>('DATABASE_URL'),

        ssl: resolveDatabaseSsl({
          enabled: configService.get<string>('DATABASE_SSL'),
          rejectUnauthorized: configService.get<string>(
            'DATABASE_SSL_REJECT_UNAUTHORIZED',
          ),
          caPath: configService.get<string>('DATABASE_SSL_CA'),
        }),

        extra: {
          max: resolveDatabasePoolSize(
            configService.get<string>('DATABASE_POOL_SIZE'),
          ),
          connectionTimeoutMillis: resolveConnectionTimeout(
            configService.get<string>('DATABASE_CONNECTION_TIMEOUT_MS'),
          ),
          idleTimeoutMillis: resolveIdleTimeout(
            configService.get<string>('DATABASE_IDLE_TIMEOUT_MS'),
          ),
        },

        // gen_random_uuid() is built into PostgreSQL 13+. Do not require a
        // managed database user to run CREATE EXTENSION.
        uuidExtension: 'pgcrypto' as const,
        installExtensions: false,

        autoLoadEntities: true,

        // Migrations are the schema authority in every environment.
        synchronize: false,
        migrations: [join(__dirname, 'database', 'migrations', '*.{ts,js}')],
        migrationsRun: false,
      }),
    }),

    UsersModule,
    AuthModule,
    RedisModule,
    LobbiesModule,
    MatchmakingModule,
    ForumModule,
  ],

  controllers: [AppController, DatabaseController],

  providers: [AppService],
})
export class AppModule {}

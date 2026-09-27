import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LobbiesController } from './lobbies/lobbies.controller';

import { UsersModule } from './users/users.module';
import { DatabaseController } from './database/database.controller';

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

        synchronize:
          configService.get<string>('NODE_ENV') !== 'production',
      }),
    }),

    UsersModule,
  ],

  controllers: [
    AppController,
    LobbiesController,
    DatabaseController,
  ],

  providers: [AppService],
})
export class AppModule {}
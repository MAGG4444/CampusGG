import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LobbiesController } from './lobbies/lobbies.controller';

@Module({
  controllers: [AppController, LobbiesController],
  providers: [AppService],
})
export class AppModule {}
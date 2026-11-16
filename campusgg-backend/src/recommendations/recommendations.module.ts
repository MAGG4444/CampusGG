import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { LobbiesModule } from '../lobbies/lobbies.module';
import { UsersModule } from '../users/users.module';
import { RecommendationsController } from './recommendations.controller';
import { RecommendationsService } from './recommendations.service';

@Module({
  imports: [LobbiesModule, UsersModule, AuthModule],
  controllers: [RecommendationsController],
  providers: [RecommendationsService],
  exports: [RecommendationsService],
})
export class RecommendationsModule {}

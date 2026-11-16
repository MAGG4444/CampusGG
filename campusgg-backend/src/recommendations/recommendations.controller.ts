import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard';
import { LobbyRecommendationsQueryDto } from './dto/lobby-recommendations-query.dto';
import { QuickJoinDto } from './dto/quick-join.dto';
import { SuggestedUsersQueryDto } from './dto/suggested-users-query.dto';
import { RecommendationsService } from './recommendations.service';

@Controller('recommendations')
@UseGuards(JwtAuthGuard)
export class RecommendationsController {
  constructor(
    private readonly recommendationsService: RecommendationsService,
  ) {}

  @Get('lobbies')
  recommendLobbies(
    @Req() request: AuthenticatedRequest,
    @Query() query: LobbyRecommendationsQueryDto,
  ) {
    return this.recommendationsService.recommendLobbies(
      request.user!.id,
      query,
    );
  }

  @Get('users')
  recommendUsers(
    @Req() request: AuthenticatedRequest,
    @Query() query: SuggestedUsersQueryDto,
  ) {
    return this.recommendationsService.recommendUsers(request.user!.id, query);
  }

  @Post('quick-join')
  quickJoin(@Req() request: AuthenticatedRequest, @Body() dto: QuickJoinDto) {
    return this.recommendationsService.quickJoin(request.user!.id, dto);
  }
}

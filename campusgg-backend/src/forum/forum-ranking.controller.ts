import {
  BadRequestException,
  Controller,
  DefaultValuePipe,
  Get,
  ParseIntPipe,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard';
import { ForumRankingService } from './forum-ranking.service';

@Controller('forum/feed')
export class ForumRankingController {
  constructor(private readonly ranking: ForumRankingService) {}
  @Get('all')
  all(
    @Query('sort', new DefaultValuePipe('new')) sort: string,
    @Query('search', new DefaultValuePipe('')) search: string,
    @Query('channel', new DefaultValuePipe('')) channel: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(25), ParseIntPipe) limit: number,
  ) {
    if (typeof search !== 'string')
      throw new BadRequestException('Invalid search');
    return this.ranking.rank({
      sort,
      window: 'all',
      page,
      limit,
      publicFeed: true,
      search,
      channel,
    });
  }
  @Get('popular')
  popular(
    @Query('sort', new DefaultValuePipe('hot')) sort: string,
    @Query('window', new DefaultValuePipe('all')) window: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(25), ParseIntPipe) limit: number,
  ) {
    return this.ranking.rank({ sort, window, page, limit, recognized: true });
  }
  @Get('for-you')
  @UseGuards(JwtAuthGuard)
  forYou(
    @Req() req: AuthenticatedRequest,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(25), ParseIntPipe) limit: number,
  ) {
    if (!req.user?.id) throw new UnauthorizedException();
    return this.ranking.rank({
      sort: 'hot',
      window: 'all',
      page,
      limit,
      personalized: true,
      userId: req.user.id,
    });
  }
}

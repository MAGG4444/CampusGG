import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { isUUID } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard';
import { ForumPostFollowsService } from './forum-post-follows.service';
import { ForumRankingService } from './forum-ranking.service';

@Controller('forum')
@UseGuards(JwtAuthGuard)
export class ForumPostFollowsController {
  constructor(
    private readonly follows: ForumPostFollowsService,
    private readonly ranking: ForumRankingService,
  ) {}
  private user(req: AuthenticatedRequest) {
    if (!req.user?.id) throw new UnauthorizedException();
    return req.user.id;
  }
  @Get('post-follows')
  status(@Req() req: AuthenticatedRequest, @Query('ids') raw: string) {
    if (typeof raw !== 'string')
      throw new BadRequestException('Invalid post IDs');
    const ids = raw ? raw.split(',') : [];
    if (ids.length > 100 || ids.some((id) => !isUUID(id)))
      throw new BadRequestException('Invalid post IDs');
    return this.follows.status(this.user(req), ids);
  }
  @Post('posts/:id/follow')
  follow(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.follows.set(this.user(req), id, true);
  }
  @Delete('posts/:id/follow')
  unfollow(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.follows.set(this.user(req), id, false);
  }
  @Get('channels/:slug/following/posts')
  feed(
    @Req() req: AuthenticatedRequest,
    @Param('slug') slug: string,
    @Query('sort') sort = 'hot',
    @Query('window') window = 'all',
    @Query('search') search = '',
    @Query('page') page = '1',
    @Query('limit') limit = '25',
  ) {
    return this.ranking.channel(
      slug,
      sort,
      window,
      Number(page),
      Number(limit),
      search,
      this.user(req),
    );
  }
}

import {
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard';
import { ForumFollowsService } from './forum-follows.service';

@Controller('forum')
@UseGuards(JwtAuthGuard)
export class ForumFollowsController {
  constructor(private readonly follows: ForumFollowsService) {}
  private user(req: AuthenticatedRequest) {
    if (!req.user?.id) throw new UnauthorizedException();
    return req.user.id;
  }
  @Get('me/channels')
  list(@Req() req: AuthenticatedRequest) {
    return this.follows.list(this.user(req));
  }
  @Get('me/following/posts')
  feed(
    @Req() req: AuthenticatedRequest,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(25), ParseIntPipe) limit: number,
  ) {
    return this.follows.feed(this.user(req), page, limit);
  }
  @Get('channels/:slug/follow')
  status(@Req() req: AuthenticatedRequest, @Param('slug') slug: string) {
    return this.follows.status(this.user(req), slug);
  }
  @Post('channels/:slug/follow')
  follow(@Req() req: AuthenticatedRequest, @Param('slug') slug: string) {
    return this.follows.set(this.user(req), slug, true);
  }
  @Delete('channels/:slug/follow')
  unfollow(@Req() req: AuthenticatedRequest, @Param('slug') slug: string) {
    return this.follows.set(this.user(req), slug, false);
  }
}

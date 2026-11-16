import {
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { ForumRankingService } from './forum-ranking.service';
import { ForumChannelsService } from './forum-channels.service';

@Controller('forum/channels')
export class ForumChannelsController {
  constructor(
    private readonly channels: ForumChannelsService,
    private readonly ranking: ForumRankingService,
  ) {}

  @Get()
  list() {
    return this.channels.list();
  }

  @Get(':slug')
  get(@Param('slug') slug: string) {
    return this.channels.get(slug);
  }

  @Get(':slug/posts')
  posts(
    @Param('slug') slug: string,
    @Query('sort', new DefaultValuePipe('new')) sort: string,
    @Query('window', new DefaultValuePipe('all')) window: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(25), ParseIntPipe) limit: number,
  ) {
    return this.ranking.channel(slug, sort, window, page, limit);
  }
}

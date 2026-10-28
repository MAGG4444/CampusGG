import { MyContentQueryDto } from '../common/dto/my-content.dto';

import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
  Delete,
  Patch,

} from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard';

import { ForumService } from './forum.service';
import { CreateForumPostDto } from './dto/create-forum-post.dto';
import { UpdateForumPostDto } from './dto/update-forum-post.dto';

@Controller('forum/posts')
export class ForumController {
  constructor(
    private readonly forumService: ForumService,
  ) {}

  @Get()
  findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe)
    page: number,

    @Query('limit', new DefaultValuePipe(25), ParseIntPipe)
    limit: number,
  ) {
    return this.forumService.findAll(page, limit);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  findMine(
    @Req() request: AuthenticatedRequest,
    @Query() query: MyContentQueryDto,
  ) {
    if (!request.user?.id) throw new UnauthorizedException();
    return this.forumService.findMine(request.user.id, query);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.forumService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(
    @Body() dto: CreateForumPostDto,
    @Req() request: AuthenticatedRequest,
  ) {
    const userId = request.user?.id;

    if (!userId) {
      throw new UnauthorizedException();
    }

    return this.forumService.create(dto, userId);
  }


@Patch(':id')
@UseGuards(JwtAuthGuard)
update(
  @Param('id', ParseUUIDPipe) id: string,
  @Body() dto: UpdateForumPostDto,
  @Req() request: AuthenticatedRequest,
) {
  const userId = request.user?.id;

  if (!userId) {
    throw new UnauthorizedException();
  }

  return this.forumService.update(id, dto, userId);
}

@Delete(':id')
@UseGuards(JwtAuthGuard)
remove(
  @Param('id', ParseUUIDPipe) id: string,
  @Req() request: AuthenticatedRequest,
) {
  const userId = request.user?.id;

  if (!userId) {
    throw new UnauthorizedException();
  }

  return this.forumService.remove(id, userId);
}


@Post(':id/like')
@UseGuards(JwtAuthGuard)
likePost(
  @Param('id', ParseUUIDPipe) id: string,
  @Req() request: AuthenticatedRequest,
) {
  const userId = request.user?.id;

  if (!userId) {
    throw new UnauthorizedException();
  }

  return this.forumService.likePost(id, userId);
}

@Delete(':id/like')
@UseGuards(JwtAuthGuard)
unlikePost(
  @Param('id', ParseUUIDPipe) id: string,
  @Req() request: AuthenticatedRequest,
) {
  const userId = request.user?.id;

  if (!userId) {
    throw new UnauthorizedException();
  }

  return this.forumService.unlikePost(id, userId);
}

@Get(':id/likes')
getLikeCount(
  @Param('id', ParseUUIDPipe) id: string,
) {
  return this.forumService.getLikeCount(id);
}

}

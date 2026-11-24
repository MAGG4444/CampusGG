import {
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard';
import { ConnectionsService } from './connections.service';

export class SearchConnectionsQueryDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  q!: string;
}

@Controller('connections')
@UseGuards(JwtAuthGuard)
export class ConnectionsController {
  constructor(private readonly service: ConnectionsService) {}

  @Get()
  friends(@Req() req: AuthenticatedRequest) {
    return this.service.list(req.user!.id, 'friend');
  }

  @Get('recent')
  recent(@Req() req: AuthenticatedRequest) {
    return this.service.recent(req.user!.id);
  }

  @Get('incoming')
  incoming(@Req() req: AuthenticatedRequest) {
    return this.service.list(req.user!.id, 'incoming');
  }

  @Get('outgoing')
  outgoing(@Req() req: AuthenticatedRequest) {
    return this.service.list(req.user!.id, 'outgoing');
  }

  @Get('search')
  search(
    @Req() req: AuthenticatedRequest,
    @Query() query: SearchConnectionsQueryDto,
  ) {
    return this.service.search(req.user!.id, query.q);
  }

  @Get('status/:userId')
  status(
    @Req() req: AuthenticatedRequest,
    @Param('userId', ParseUUIDPipe) id: string,
  ) {
    return this.service.status(req.user!.id, id);
  }

  @Post('request/:userId')
  request(
    @Req() req: AuthenticatedRequest,
    @Param('userId', ParseUUIDPipe) id: string,
  ) {
    return this.service.request(req.user!.id, id);
  }

  @Patch('accept/:userId')
  accept(
    @Req() req: AuthenticatedRequest,
    @Param('userId', ParseUUIDPipe) id: string,
  ) {
    return this.service.accept(req.user!.id, id);
  }

  @Delete('decline/:userId')
  decline(
    @Req() req: AuthenticatedRequest,
    @Param('userId', ParseUUIDPipe) id: string,
  ) {
    return this.service.decline(req.user!.id, id);
  }

  @Delete('cancel/:userId')
  cancel(
    @Req() req: AuthenticatedRequest,
    @Param('userId', ParseUUIDPipe) id: string,
  ) {
    return this.service.cancel(req.user!.id, id);
  }

  @Delete(':userId')
  remove(
    @Req() req: AuthenticatedRequest,
    @Param('userId', ParseUUIDPipe) id: string,
  ) {
    return this.service.remove(req.user!.id, id);
  }
}

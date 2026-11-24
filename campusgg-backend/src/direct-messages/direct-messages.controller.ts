import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard';
import { DirectMessagesService } from './direct-messages.service';
import { Optional } from '@nestjs/common';
import { DirectMessageEvents } from './direct-message-events';

export class SendDirectMessageDto {
  @IsString()
  @MaxLength(2000)
  content!: string;
}
export class HistoryQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsUUID()
  before?: string;
}
export class ReadDirectMessagesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  messageIds!: string[];
}

@Controller('direct-messages')
@UseGuards(JwtAuthGuard)
export class DirectMessagesController {
  constructor(
    private readonly service: DirectMessagesService,
    @Optional() private readonly events?: DirectMessageEvents,
  ) {}

  @Get()
  list(@Req() request: AuthenticatedRequest) {
    return this.service.list(request.user!.id);
  }

  @Get(':userId')
  history(
    @Req() request: AuthenticatedRequest,
    @Param('userId', ParseUUIDPipe) target: string,
    @Query() query: HistoryQueryDto,
  ) {
    return this.service.history(
      request.user!.id,
      target,
      query.limit,
      query.before,
    );
  }

  @Post(':userId')
  async send(
    @Req() request: AuthenticatedRequest,
    @Param('userId', ParseUUIDPipe) target: string,
    @Body() dto: SendDirectMessageDto,
  ) {
    const result = await this.service.send(
      request.user!.id,
      target,
      dto.content,
    );
    this.events?.publish(request.user!.id, target);
    return result;
  }

  @Patch(':userId/read')
  async read(
    @Req() request: AuthenticatedRequest,
    @Param('userId', ParseUUIDPipe) target: string,
    @Body() dto: ReadDirectMessagesDto,
  ) {
    const result = await this.service.markRead(
      request.user!.id,
      target,
      dto.messageIds,
    );
    if (result?.updated) this.events?.publish(request.user!.id, target);
    return result;
  }
}

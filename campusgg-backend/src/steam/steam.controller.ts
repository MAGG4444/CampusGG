import {
  Controller,
  Delete,
  Get,
  HttpStatus,
  Query,
  Redirect,
  Req,
  UnauthorizedException,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard';
import { SteamStatsQueryDto } from './dto/steam-stats.dto';
import type { SteamCallbackQuery } from './steam-openid.service';
import { SteamService } from './steam.service';

@Controller('steam')
export class SteamController {
  constructor(private readonly steamService: SteamService) {}

  @Get('link')
  @UseGuards(JwtAuthGuard)
  createLink(@Req() request: AuthenticatedRequest) {
    return this.steamService.createLinkUrl(this.userId(request));
  }

  @Get('callback')
  @Redirect()
  async callback(@Query() query: SteamCallbackQuery) {
    const url = await this.steamService.handleCallback(query);

    return { url, statusCode: HttpStatus.FOUND };
  }

  @Delete('link')
  @UseGuards(JwtAuthGuard)
  unlink(@Req() request: AuthenticatedRequest) {
    return this.steamService.unlinkSteam(this.userId(request));
  }

  @Get('stats')
  @UseGuards(JwtAuthGuard)
  stats(
    @Req() request: AuthenticatedRequest,
    @Query(
      new ValidationPipe({
        expectedType: SteamStatsQueryDto,
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    )
    query: SteamStatsQueryDto,
  ) {
    return this.steamService.getStats(this.userId(request), query);
  }

  private userId(request: AuthenticatedRequest): string {
    if (!request.user?.id) {
      throw new UnauthorizedException();
    }

    return request.user.id;
  }
}

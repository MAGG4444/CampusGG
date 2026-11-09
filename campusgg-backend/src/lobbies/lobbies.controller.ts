import { MyContentQueryDto } from '../common/dto/my-content.dto';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard';

import { CreateLobbyDto } from './dto/create-lobby.dto';
import { SearchLobbiesDto } from './dto/search-lobbies.dto';
import { LobbiesService } from './lobbies.service';

@Controller('lobbies')
export class LobbiesController {
  constructor(private readonly lobbiesService: LobbiesService) {}

  // ============================================================
  // GET ALL MOCK LOBBIES
  // Keep existing mock data until frontend integration
  // ============================================================

  @Get()
  getAllLobbies() {
    return [
      {
        id: 1,
        name: 'Valorant Ranked Grind',
        host: 'Justin',
        game: 'Valorant',
        level: 'Advanced',
        details: 'Gold/Plat players only',
      },
      {
        id: 2,
        name: 'Late Night CS2 Queue',
        host: 'Alex',
        game: 'CS2',
        level: 'Intermediate',
        details: 'Competitive matches',
      },
      {
        id: 3,
        name: 'Apex Chill Lobby',
        host: 'Maya',
        game: 'Apex',
        level: 'Beginner',
        details: 'Casual trios and ranked',
      },
      {
        id: 4,
        name: 'Overwatch 2 Team Up',
        host: 'Chris',
        game: 'Overwatch 2',
        level: 'Intermediate',
        details: 'Need support and tank',
      },
    ];
  }

  // ============================================================
  // GET DATABASE LOBBIES
  // Retrieve real PostgreSQL lobbies with optional filters
  // ============================================================

  @Get('db')
  async getDatabaseLobbies(@Query() filters: SearchLobbiesDto) {
    return this.lobbiesService.findAll(filters);
  }

  // ============================================================
  // GET LOBBY BY ID
  // Retrieve a specific PostgreSQL lobby using its UUID
  // ============================================================

  @Get('me')
  @UseGuards(JwtAuthGuard)
  findMine(
    @Req() request: AuthenticatedRequest,
    @Query() query: MyContentQueryDto,
  ) {
    if (!request.user?.id) throw new UnauthorizedException();
    return this.lobbiesService.findMine(request.user.id, query);
  }

  @Get(':id')
  async getLobbyById(@Param('id', ParseUUIDPipe) id: string) {
    return this.lobbiesService.findOne(id);
  }

  // ============================================================
  // AUTHENTICATED USER HELPER
  // Extract user ID from the verified JWT
  // ============================================================

  private getAuthenticatedUserId(request: AuthenticatedRequest): string {
    if (!request.user?.id) {
      throw new UnauthorizedException('Authentication required');
    }

    return request.user.id;
  }

  // ============================================================
  // CREATE LOBBY
  // Only authenticated users can create lobbies
  // ============================================================

  @Post()
  @UseGuards(JwtAuthGuard)
  async createLobby(
    @Body() dto: CreateLobbyDto,
    @Req() request: AuthenticatedRequest,
  ) {
    const userId = this.getAuthenticatedUserId(request);

    return this.lobbiesService.create(dto, userId);
  }

  // ============================================================
  // JOIN LOBBY
  // Add the authenticated user to an existing public lobby
  // ============================================================

  @Post(':id/join')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async joinLobby(
    @Param('id', ParseUUIDPipe) lobbyId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    const userId = this.getAuthenticatedUserId(request);

    await this.lobbiesService.joinLobby(lobbyId, userId);

    return {
      message: 'Successfully joined lobby',
    };
  }

  // ============================================================
  // LEAVE LOBBY
  // Remove the authenticated user from an existing lobby
  // ============================================================

  @Post(':id/leave')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async leaveLobby(
    @Param('id', ParseUUIDPipe) lobbyId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    const userId = this.getAuthenticatedUserId(request);

    await this.lobbiesService.leaveLobby(lobbyId, userId);

    return {
      message: 'Successfully left lobby',
    };
  }

  @Get(':id/members')
  @UseGuards(JwtAuthGuard)
  async getLobbyMembers(@Param('id', ParseUUIDPipe) lobbyId: string) {
    return this.lobbiesService.findMembers(lobbyId);
  }
}

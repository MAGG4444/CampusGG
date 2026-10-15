import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { UsersService } from '../users/users.service';
import { CreateLobbyDto } from './dto/create-lobby.dto';
import { Lobby, LobbyVisibility } from './lobby.entity';

@Injectable()
export class LobbiesService {
  constructor(
    @InjectRepository(Lobby)
    private readonly lobbiesRepository: Repository<Lobby>,
    private readonly usersService: UsersService,
  ) {}

  // Retrieve all lobbies from PostgreSQL
  async findAll(): Promise<Lobby[]> {
    return this.lobbiesRepository.find({
      order: {
        createdAt: 'DESC',
      },
    });
  }

  // Retrieve a specific lobby by ID
  async findOne(id: string): Promise<Lobby> {
    const lobby = await this.lobbiesRepository.findOne({
      where: { id },
    });

    if (!lobby) {
      throw new NotFoundException(`Lobby ${id} not found`);
    }

    return lobby;
  }

  // Create a new lobby in PostgreSQL
  async create(
    createLobbyDto: CreateLobbyDto,
    hostUserId: string,
  ): Promise<Lobby> {
    // Find the user hosting the lobby
    const host = await this.usersService.findOne(hostUserId);

    // Create the lobby entity
    const lobby = this.lobbiesRepository.create({
      lobbyName: createLobbyDto.lobbyName,
      subtitle: createLobbyDto.subtitle ?? null,
      details: createLobbyDto.details,
      tags: createLobbyDto.tags ?? [],
      game: createLobbyDto.game ?? null,
      skillLevel: createLobbyDto.skillLevel ?? null,
      participantLimit: createLobbyDto.participantLimit ?? null,
      visibility: createLobbyDto.visibility ?? LobbyVisibility.PUBLIC,
      host,
    });

    // Save the lobby to PostgreSQL
    return this.lobbiesRepository.save(lobby);
  }
}

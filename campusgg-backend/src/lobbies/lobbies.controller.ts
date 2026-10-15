import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';

import { LobbiesService } from './lobbies.service';
import { Query } from '@nestjs/common';
import { SearchLobbiesDto } from './dto/search-lobbies.dto';

@Controller('lobbies')
export class LobbiesController {
  constructor(private readonly lobbiesService: LobbiesService) {}
  //temporary endpoitn for testing PostgreSQL
  @Get('db')
  async getDatabaseLobbies(@Query() filters: SearchLobbiesDto) {
    return this.lobbiesService.findAll(filters);
  }

  @Get(':id')
  async getLobbyById(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.lobbiesService.findOne(id);
  }

  //existing frontend mock data
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
}

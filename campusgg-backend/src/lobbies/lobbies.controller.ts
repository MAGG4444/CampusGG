import { Controller, Get } from '@nestjs/common';

@Controller('lobbies')
export class LobbiesController {
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
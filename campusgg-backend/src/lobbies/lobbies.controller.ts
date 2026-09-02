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
        details: 'Gold/Plat players only',
      },
      {
        id: 2,
        name: 'Late Night CS2 Queue',
        host: 'Alex',
        details: 'Competitive matches',
      },
      {
        id: 3,
        name: 'Apex Chill Lobby',
        host: 'Maya',
        details: 'Casual trios and ranked',
      },
      {
        id: 4,
        name: 'Overwatch 2 Team Up',
        host: 'Chris',
        details: 'Need support and tank',
      },
    ];
  }
}
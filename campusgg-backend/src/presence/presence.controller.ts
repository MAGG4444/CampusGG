import { Controller, Get, Header, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard';
import { ConnectionsService } from '../connections/connections.service';
import { PresenceService } from './presence.service';

@Controller('presence')
@UseGuards(JwtAuthGuard)
export class PresenceController {
  constructor(
    private readonly connections: ConnectionsService,
    private readonly presence: PresenceService,
  ) {}

  @Get('friends')
  @Header('Cache-Control', 'no-store')
  async friends(@Req() request: AuthenticatedRequest) {
    // The existing connections service verifies the viewer and filters out
    // unverified accounts. No arbitrary target ID is accepted from clients.
    const { items } = await this.connections.list(request.user!.id, 'friend');
    const statuses: Array<{ userId: string; online: boolean | null }> = [];
    for (let start = 0; start < items.length; start += 25) {
      statuses.push(
        ...(await Promise.all(
          items
            .slice(start, start + 25)
            .map(async ({ id }) => ({
              userId: id,
              online: await this.presence.status(id),
            })),
        )),
      );
    }
    return { items: statuses };
  }
}

jest.mock('../redis/redis.service', () => ({ RedisService: jest.fn() }));
jest.mock('@nestjs/jwt', () => ({ JwtService: jest.fn() }));
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard';
import type { ConnectionsService } from '../connections/connections.service';
import type { PresenceService } from './presence.service';
import { PresenceController } from './presence.controller';

describe('PresenceController', () => {
  it('uses JWT and returns statuses only for the viewer’s accepted friends', async () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, PresenceController)).toContain(
      JwtAuthGuard,
    );
    const connections = {
      list: jest
        .fn()
        .mockResolvedValue({ items: [{ id: 'friend' }, { id: 'other' }] }),
    };
    const presence = {
      status: jest.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(null),
    };
    const controller = new PresenceController(
      connections as unknown as ConnectionsService,
      presence as unknown as PresenceService,
    );
    await expect(
      controller.friends({ user: { id: 'viewer' } } as AuthenticatedRequest),
    ).resolves.toEqual({
      items: [
        { userId: 'friend', online: true },
        { userId: 'other', online: null },
      ],
    });
    expect(connections.list).toHaveBeenCalledWith('viewer', 'friend');
    expect(presence.status.mock.calls).toEqual([['friend'], ['other']]);
  });
});

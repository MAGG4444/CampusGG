import { ForbiddenException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { Connection } from './connection.entity';
import { ConnectionsService } from './connections.service';
import { recentPlayersSql } from './recent-players';

const viewer = '00000000-0000-4000-8000-000000000001';

describe('Recent shared lobby history', () => {
  const query = jest.fn();
  const findOneBy = jest.fn();
  const users = {
    findOneBy,
    manager: {
      connection: {
        options: { schema: 'public' },
        driver: { escape: (s: string) => `"${s}"` },
      },
      query,
    },
  } as unknown as Repository<User>;
  const service = new ConnectionsService({} as Repository<Connection>, users);
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects an unverified viewer before querying history', async () => {
    findOneBy.mockResolvedValue(null);
    await expect(service.recent(viewer)).rejects.toThrow(ForbiddenException);
    expect(query).not.toHaveBeenCalled();
  });

  it('uses only the verified viewer as a bound SQL parameter', async () => {
    findOneBy.mockResolvedValue({ id: viewer });
    const items = [{ id: 'friend', sharedSessions: 2, relationship: 'friend' }];
    query.mockResolvedValue(items);
    await expect(service.recent(viewer)).resolves.toEqual({ items });
    expect(findOneBy).toHaveBeenCalledWith({ id: viewer, eduVerified: true });
    expect(query).toHaveBeenCalledWith(recentPlayersSql('"public"'), [viewer]);
  });

  it('scopes both pair directions, excludes unverified users and limits results', () => {
    const sql = recentPlayersSql('"public"');
    expect(sql).toContain('user_low = $1::uuid');
    expect(sql).toContain('user_high = $1::uuid');
    expect(sql).toContain('u.edu_verified = true');
    expect(sql).toContain('WHERE r.rank = 1');
    expect(sql).toContain('LIMIT 50');
    expect(sql).not.toMatch(/u\.(email|password|verification_token)/);
  });
});

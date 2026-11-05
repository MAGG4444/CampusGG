import { GUARDS_METADATA } from '@nestjs/common/constants';
import { JwtAuthGuard, AuthenticatedRequest } from '../auth/jwt-auth.guard';
import { MatchmakingController } from './matchmaking.controller';
import { MatchmakingService } from './matchmaking.service';
import { PlayerMatchmakingInput } from './schemas/player-matchmaking.schema';

jest.mock('./matchmaking.service.js', () => ({}), { virtual: true });
jest.mock('@nestjs/jwt', () => ({ JwtService: class {} }));

describe('MatchmakingController authentication', () => {
  it('requires the JWT guard and uses its identity instead of client IDs', async () => {
    const enqueue = jest.fn();
    const getMatchStatus = jest.fn();
    const dequeue = jest.fn().mockResolvedValue({ status: 'cancelled' });
    const controller = new MatchmakingController({
      enqueue,
      getMatchStatus,
      dequeue,
    } as unknown as MatchmakingService);
    const request = {
      user: { id: 'authenticated-user' },
    } as AuthenticatedRequest;
    const body = { userId: 'other-user' } as PlayerMatchmakingInput;
    controller.enqueue(body, request);
    await controller.getMatchStatus(request);
    await controller.dequeue(request);
    expect(enqueue).toHaveBeenCalledWith({ userId: 'authenticated-user' });
    expect(getMatchStatus).toHaveBeenCalledWith('authenticated-user');
    expect(dequeue).toHaveBeenCalledWith('authenticated-user');
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      MatchmakingController,
    ) as unknown[];
    expect(guards).toContain(JwtAuthGuard);
  });
});

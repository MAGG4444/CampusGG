import { MatchmakingService } from './matchmaking.service';
import { LobbiesService } from '../lobbies/lobbies.service';
import { MatchGroup } from './schemas/match-group.schema';

jest.mock('./engine/matchmaking-engine.js', () => ({}), { virtual: true });
jest.mock('./engine/strategy-registry.js', () => ({}), { virtual: true });
jest.mock('../lobbies/lobbies.service.js', () => ({}), { virtual: true });
jest.mock(
  '../lobbies/lobby.entity.js',
  () => ({ LobbyVisibility: { PRIVATE: 'private' } }),
  { virtual: true },
);

describe('matchmaking lobby handoff', () => {
  const group: MatchGroup = {
    groupId: 'group',
    game: 'It Takes Two',
    tier: 'CASUAL',
    userIds: ['host', 'member'],
    score: 0.9,
    matchedAt: new Date().toISOString(),
  } as MatchGroup;

  it('publishes the lobby to every player only after enrollment succeeds', async () => {
    const createMatchedLobby = jest.fn().mockResolvedValue({ id: 'lobby' });
    const service = new MatchmakingService({
      createMatchedLobby,
      isMember: jest.fn().mockResolvedValue(true),
    } as unknown as LobbiesService);
    await service['handleMatchFound'](group);
    expect(createMatchedLobby).toHaveBeenCalledWith(
      expect.any(Object),
      group.userIds,
    );
    for (const id of group.userIds) {
      expect(await service.getMatchStatus(id)).toEqual({
        matched: true,
        lobbyId: 'lobby',
      });
      expect(await service.getMatchStatus(id)).toEqual({
        matched: true,
        lobbyId: 'lobby',
      });
    }
  });

  it('reports a recoverable failure to every removed player', async () => {
    const createMatchedLobby = jest
      .fn()
      .mockRejectedValue(new Error('enrollment failed'));
    const service = new MatchmakingService({
      createMatchedLobby,
    } as unknown as LobbiesService);
    await service['handleMatchFound'](group);
    for (const id of group.userIds) {
      const result = await service.getMatchStatus(id);
      expect(result.matched).toBe(false);
      expect(result.error).toContain('try matchmaking again');
    }
    service['engine'] = { dequeue: jest.fn().mockReturnValue(false) } as never;
    const cancellation = await service.dequeue('member');
    expect(cancellation.status).toBe('failed');
  });

  it('rejects re-enqueue while a match is being enrolled', async () => {
    let finish!: (value: { id: string }) => void;
    const createMatchedLobby = jest.fn().mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const service = new MatchmakingService({
      createMatchedLobby,
    } as unknown as LobbiesService);
    const pending = service['handleMatchFound'](group);
    expect(() => service.enqueue({ userId: 'member' } as never)).toThrow(
      'already queued or matched',
    );
    finish({ id: 'lobby' });
    await pending;
  });

  it('distinguishes cancellation, processing and a completed match', async () => {
    let finish!: (value: { id: string }) => void;
    const createMatchedLobby = jest.fn().mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const service = new MatchmakingService({
      createMatchedLobby,
      isMember: jest.fn().mockResolvedValue(true),
    } as unknown as LobbiesService);
    service['engine'] = {
      dequeue: jest.fn().mockReturnValueOnce(true).mockReturnValue(false),
    } as never;
    expect(await service.dequeue('queued')).toEqual({ status: 'cancelled' });
    expect(await service.dequeue('missing')).toEqual({ status: 'idle' });
    const pending = service['handleMatchFound'](group);
    expect(await service.dequeue('member')).toEqual({ status: 'processing' });
    finish({ id: 'lobby' });
    await pending;
    expect(await service.dequeue('member')).toEqual({
      status: 'matched',
      lobbyId: 'lobby',
    });
    expect(await service.getMatchStatus('member')).toEqual({
      matched: true,
      lobbyId: 'lobby',
    });
  });

  it('clears a stale match when the user no longer belongs to its lobby', async () => {
    const service = new MatchmakingService({
      createMatchedLobby: jest.fn().mockResolvedValue({ id: 'lobby' }),
      isMember: jest.fn().mockResolvedValue(false),
    } as unknown as LobbiesService);
    await service['handleMatchFound'](group);
    expect(await service.getMatchStatus('member')).toEqual({
      matched: false,
      processing: false,
      queued: false,
    });
  });
});

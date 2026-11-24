jest.mock('../redis/redis.service', () => ({ RedisService: jest.fn() }));
import type { RedisService } from '../redis/redis.service';
import { PresenceService, RENEW, REMOVE, READ } from './presence.service';

describe('PresenceService', () => {
  const flush = async () => {
    for (let i = 0; i < 8; i++) await Promise.resolve();
  };
  const create = () => {
    const redis = {
      isAvailable: jest.fn().mockReturnValue(true),
      evalScript: jest.fn().mockResolvedValue(1),
    };
    return {
      redis,
      service: new PresenceService(redis as unknown as RedisService),
    };
  };
  afterEach(() => jest.useRealTimers());

  it('reports online/offline from Redis, and unknown on failure', async () => {
    const { redis, service } = create();
    redis.evalScript
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(0)
      .mockRejectedValueOnce(new Error('down'));
    await expect(service.status('ABC')).resolves.toBe(true);
    await expect(service.status('ABC')).resolves.toBe(false);
    await expect(service.status('ABC')).resolves.toBeNull();
    expect(redis.evalScript).toHaveBeenCalledWith(
      READ,
      ['campusgg:presence:v1:abc'],
      [],
    );
    redis.isAvailable.mockReturnValue(false);
    await expect(service.status('ABC')).resolves.toBeNull();
  });

  it('renews each tab separately and removes only the disconnected lease', async () => {
    jest.useFakeTimers();
    const { redis, service } = create();
    try {
      service.attach('tab-a', 'user');
      service.attach('tab-b', 'user');
      await flush();
      const a = (
        redis.evalScript.mock.calls[0] as [string, string[], string[]]
      )[2][0];
      const b = (
        redis.evalScript.mock.calls[1] as [string, string[], string[]]
      )[2][0];
      expect(a).not.toBe(b);
      service.detach('tab-a');
      await flush();
      expect(redis.evalScript).toHaveBeenCalledWith(
        REMOVE,
        ['campusgg:presence:v1:user'],
        [a],
      );
      redis.evalScript.mockClear();
      jest.advanceTimersByTime(20_000);
      await flush();
      expect(redis.evalScript).toHaveBeenCalledTimes(1);
      expect(redis.evalScript).toHaveBeenCalledWith(
        RENEW,
        ['campusgg:presence:v1:user'],
        [b, '75000'],
      );
    } finally {
      service.onModuleDestroy();
      await flush();
    }
  });

  it('removes a disconnected lease after a pending renewal completes', async () => {
    const { redis, service } = create();
    let finish!: (value: number) => void;
    redis.evalScript.mockImplementationOnce(
      () =>
        new Promise<number>((resolve) => {
          finish = resolve;
        }),
    );
    service.attach('tab', 'user');
    service.detach('tab');
    expect(redis.evalScript).toHaveBeenCalledTimes(1);
    finish(1);
    await flush();
    expect(redis.evalScript).toHaveBeenCalledTimes(2);
    expect(redis.evalScript).toHaveBeenLastCalledWith(
      REMOVE,
      ['campusgg:presence:v1:user'],
      expect.any(Array),
    );
  });

  it('recovers presence on a heartbeat when Redis becomes available', async () => {
    jest.useFakeTimers();
    const { redis, service } = create();
    try {
      redis.isAvailable.mockReturnValue(false);
      service.attach('tab', 'user');
      expect(redis.evalScript).not.toHaveBeenCalled();
      redis.isAvailable.mockReturnValue(true);
      jest.advanceTimersByTime(20_000);
      await flush();
      expect(redis.evalScript).toHaveBeenCalledWith(
        RENEW,
        ['campusgg:presence:v1:user'],
        expect.any(Array),
      );
    } finally {
      service.onModuleDestroy();
      await flush();
    }
  });
});

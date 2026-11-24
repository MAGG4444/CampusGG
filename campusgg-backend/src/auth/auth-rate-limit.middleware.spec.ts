import type { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import type { RedisService } from '../redis/redis.service';
import { AuthRateLimitMiddleware } from './auth-rate-limit.middleware';

jest.mock('../redis/redis.service', () => ({ RedisService: jest.fn() }));

describe('AuthRateLimitMiddleware', () => {
  function setup(env = 'production', enabled = 'true') {
    const config = {
      get: (key: string) => (key === 'NODE_ENV' ? env : enabled),
      getOrThrow: () => 'test-secret',
    };
    const consume = jest
      .fn()
      .mockResolvedValue({ allowed: true, retryAfter: 0 });
    const redis = {
      isAvailable: jest.fn().mockReturnValue(true),
      consumeAuthRateLimit: consume,
    };
    const middleware = new AuthRateLimitMiddleware(
      config as unknown as ConfigService,
      redis as unknown as RedisService,
    );
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      setHeader: jest.fn(),
    };
    const next = jest.fn();
    const req = (action = 'verify', email = ' Test@purdue.edu ') =>
      ({
        method: 'POST',
        originalUrl: `/api/auth/${action}`,
        ip: '127.0.0.1',
        body: { email },
        socket: {},
      }) as unknown as Request;
    const run = (action?: string, email?: string) =>
      middleware.use(req(action, email), res as unknown as Response, next);
    return { consume, redis, res, next, run };
  }
  it('limits IP and normalized account independently without storing email', async () => {
    const { consume, next, run } = setup();
    await run();
    await run('verify', 'test@purdue.edu');
    expect(consume).toHaveBeenCalledTimes(4);
    expect(consume.mock.calls[0].slice(1)).toEqual([100, 900]);
    expect(consume.mock.calls[1].slice(1)).toEqual([8, 900]);
    expect(consume.mock.calls[1][0]).toBe(consume.mock.calls[3][0]);
    expect(consume.mock.calls[1][0]).not.toContain('purdue.edu');
    expect(next).toHaveBeenCalledTimes(2);
  });
  it('returns 429 and Retry-After without invoking authentication', async () => {
    const { consume, res, next, run } = setup();
    consume
      .mockResolvedValueOnce({ allowed: true })
      .mockResolvedValueOnce({ allowed: false, retryAfter: 60 });
    await run();
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.setHeader).toHaveBeenCalledWith('Retry-After', '60');
    expect(next).not.toHaveBeenCalled();
  });
  it('fails closed if Redis is unavailable in production', async () => {
    const { redis, res, next, run } = setup();
    redis.isAvailable.mockReturnValue(false);
    await run();
    expect(res.status).toHaveBeenCalledWith(503);
    expect(next).not.toHaveBeenCalled();
  });
  it('allows explicitly Redis-disabled local development', async () => {
    const { consume, next, run } = setup('development', 'false');
    await run();
    expect(consume).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });
  it('uses separate limits for login, registration and resend', async () => {
    const { consume, run } = setup();
    for (const action of ['login', 'register', 'resend-verification'])
      await run(action);
    expect(
      consume.mock.calls
        .filter((_, i) => i % 2 === 1)
        .map((call) => call.slice(1)),
    ).toEqual([
      [10, 900],
      [3, 3600],
      [3, 900],
    ]);
  });
  it('fails closed for a rejected Redis command', async () => {
    const { consume, res, next, run } = setup();
    consume.mockRejectedValueOnce(new Error('Redis unavailable'));
    await run();
    expect(res.status).toHaveBeenCalledWith(503);
    expect(next).not.toHaveBeenCalled();
  });
});

import { Injectable, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { RedisService } from '../redis/redis.service';

const RULES: Record<string, { account: number; ip: number; seconds: number }> =
  {
    login: { account: 10, ip: 100, seconds: 900 },
    register: { account: 3, ip: 30, seconds: 3600 },
    verify: { account: 8, ip: 100, seconds: 900 },
    'resend-verification': { account: 3, ip: 30, seconds: 900 },
  };

@Injectable()
export class AuthRateLimitMiddleware implements NestMiddleware {
  constructor(
    private readonly config: ConfigService,
    private readonly redis: RedisService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    const path = req.originalUrl
      .split('?')[0]
      .replace(/\/+$/, '')
      .toLowerCase();
    const action = path.split('/').at(-1) ?? '';
    const rule = Object.hasOwn(RULES, action) ? RULES[action] : undefined;
    if (req.method !== 'POST' || !rule) {
      next();
      return;
    }
    const production = this.config.get<string>('NODE_ENV') === 'production';
    const enabled = this.config.get<string>('REDIS_ENABLED') === 'true';
    if (!production && !enabled) {
      next();
      return;
    }
    try {
      if (!enabled || !this.redis.isAvailable())
        throw new Error('Rate limit storage unavailable');
      const secret = this.config.getOrThrow<string>('JWT_SECRET');
      const key = (scope: string, value: string) =>
        `campusgg:auth-limit:v1:${action}:${scope}:${createHmac('sha256', secret).update(value).digest('hex')}`;
      const ip = req.ip || req.socket.remoteAddress || 'unknown';
      const buckets = [{ key: key('ip', ip), limit: rule.ip }];
      const body = req.body as { email?: unknown } | undefined;
      if (typeof body?.email === 'string' && body.email.length <= 320) {
        const email = body.email.trim().toLowerCase();
        if (email)
          buckets.push({ key: key('account', email), limit: rule.account });
      }
      for (const bucket of buckets) {
        const result = await this.redis.consumeAuthRateLimit(
          bucket.key,
          bucket.limit,
          rule.seconds,
        );
        if (!result.allowed) {
          res.setHeader('Retry-After', String(result.retryAfter));
          res
            .status(429)
            .json({
              statusCode: 429,
              message: 'Too many requests. Please try again later.',
            });
          return;
        }
      }
    } catch {
      res
        .status(503)
        .json({
          statusCode: 503,
          message:
            'Authentication temporarily unavailable. Please try again later.',
        });
      return;
    }
    next();
  }
}

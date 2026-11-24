import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { RedisService } from '../redis/redis.service';

const HEARTBEAT_MS = 20_000;
const LEASE_MS = 75_000;
// Redis time, not application-server time, keeps multiple instances consistent.
const NOW =
  "local t = redis.call('TIME'); local now = tonumber(t[1])*1000 + math.floor(tonumber(t[2])/1000); ";
export const RENEW =
  NOW +
  "redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', now); redis.call('ZADD', KEYS[1], now + tonumber(ARGV[2]), ARGV[1]); redis.call('PEXPIRE', KEYS[1], ARGV[2]); return 1";
export const REMOVE = "redis.call('ZREM', KEYS[1], ARGV[1]); return 1";
export const READ =
  NOW + "return redis.call('ZCOUNT', KEYS[1], '(' .. now, '+inf')";

type Lease = {
  key: string;
  member: string;
  timer?: ReturnType<typeof setInterval>;
  pending?: Promise<void>;
};

@Injectable()
export class PresenceService implements OnModuleDestroy {
  private readonly leases = new Map<string, Lease>();
  constructor(private readonly redis: RedisService) {}

  private key(userId: string): string {
    return `campusgg:presence:v1:${userId.toLowerCase()}`;
  }

  attach(socketId: string, userId: string): void {
    this.detach(socketId);
    const lease: Lease = { key: this.key(userId), member: randomUUID() };
    this.leases.set(socketId, lease);
    const renew = () => {
      if (
        lease.pending ||
        this.leases.get(socketId) !== lease ||
        !this.redis.isAvailable()
      )
        return;
      lease.pending = this.redis
        .evalScript(RENEW, [lease.key], [lease.member, String(LEASE_MS)])
        .then(
          () => undefined,
          () => undefined,
        )
        .finally(() => {
          lease.pending = undefined;
        });
    };
    renew();
    lease.timer = setInterval(renew, HEARTBEAT_MS);
    lease.timer.unref();
  }

  detach(socketId: string): void {
    const lease = this.leases.get(socketId);
    if (!lease) return;
    this.leases.delete(socketId);
    clearInterval(lease.timer);
    // Wait for any in-flight renewal before removal, so it cannot resurrect
    // a disconnected socket. A failed removal expires automatically.
    void Promise.resolve(lease.pending)
      .then(async () => {
        if (this.redis.isAvailable())
          await this.redis.evalScript(REMOVE, [lease.key], [lease.member]);
      })
      .catch(() => undefined);
  }

  async status(userId: string): Promise<boolean | null> {
    if (!this.redis.isAvailable()) return null;
    try {
      const count = await this.redis.evalScript(READ, [this.key(userId)], []);
      return typeof count === 'number' &&
        Number.isSafeInteger(count) &&
        count >= 0
        ? count > 0
        : null;
    } catch {
      return null;
    }
  }

  onModuleDestroy(): void {
    for (const id of this.leases.keys()) this.detach(id);
  }
}

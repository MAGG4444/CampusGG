import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { createClient, RedisClientType } from 'redis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client!: RedisClientType;

  async onModuleInit() {
    const redisEnabled = process.env.REDIS_ENABLED === 'true';

    if (!redisEnabled) {
      console.log('Redis disabled for local development.');
      return;
    }

    const host = process.env.REDIS_HOST;
    const port = process.env.REDIS_PORT || '6379';

    this.client = createClient({
      socket: {
        host,
        port: Number(port),
        tls: true,
      },
    });

    this.client.on('error', (error) => {
      console.error('Redis Client Error:', error);
    });

    console.log('Attempting to connect to AWS ElastiCache...');

    try {
      await this.client.connect();
      console.log('Connected to AWS ElastiCache');
    } catch (error) {
      console.error('Could not connect to AWS ElastiCache.');
    }
  }

  async onModuleDestroy() {
    if (this.client?.isOpen) {
      await this.client.quit();
    }
  }

  async set(
    key: string,
    value: string,
    expirationSeconds?: number,
  ) {
    if (expirationSeconds) {
      return this.client.set(key, value, {
        EX: expirationSeconds,
      });
    }

    return this.client.set(key, value);
  }

  async get(key: string) {
    return this.client.get(key);
  }

  async delete(key: string) {
    return this.client.del(key);
  }
}
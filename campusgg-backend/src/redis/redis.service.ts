import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
  ServiceUnavailableException,
} from '@nestjs/common';

import { ConfigService } from '@nestjs/config';
import { createClient } from 'redis';

// Factory function allows TypeScript to infer the
// exact Redis client type without empty object types.
function createRedisClient(url: string) {
  return createClient({
    url,
    socket: {
      connectTimeout: 5000,
      reconnectStrategy: (retries: number) => {
        if (retries >= 3) {
          return false;
        }

        return Math.min(100 * 2 ** retries, 1000);
      },
    },
    disableOfflineQueue: true,
  });
}

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);

  private client?: ReturnType<typeof createRedisClient>;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const enabled = this.config.get<string>('REDIS_ENABLED') === 'true';

    if (!enabled) {
      this.logger.log('Redis disabled. Skipping connection.');
      return;
    }

    const host = this.config.get<string>('REDIS_HOST');
    const port = Number(this.config.get<string>('REDIS_PORT') ?? '6379');
    const tls = this.config.get<string>('REDIS_TLS') === 'true';

    if (!host || !Number.isInteger(port) || port < 1 || port > 65535) {
      throw new Error('Invalid Redis host or port');
    }

    const protocol = tls ? 'rediss' : 'redis';

    const client = createRedisClient(`${protocol}://${host}:${port}`);

    this.client = client;

    client.on('error', (error: Error) => {
      this.logger.error(`Redis error: ${error.message}`);
    });

    try {
      this.logger.log(`Connecting to Redis at ${host}:${port}`);

      await client.connect();

      this.logger.log('Successfully connected to Redis');
    } catch (error) {
      this.logger.error(
        'Failed to connect to Redis',
        error instanceof Error ? error.stack : String(error),
      );

      if (client.isOpen) {
        client.destroy();
      }

      throw error;
    }
  }

  onModuleDestroy(): void {
    if (this.client?.isOpen) {
      this.client.destroy();
      this.logger.log('Redis connection closed.');
    }
  }

  private getClient() {
    const client = this.client;

    if (!client?.isReady) {
      throw new ServiceUnavailableException('Redis is currently unavailable');
    }

    return client;
  }

  async set(key: string, value: string, expirationSeconds?: number) {
    const client = this.getClient();

    if (expirationSeconds !== undefined) {
      return client.set(key, value, {
        EX: expirationSeconds,
      });
    }

    return client.set(key, value);
  }

  async get(key: string) {
    return this.getClient().get(key);
  }

  async delete(key: string) {
    return this.getClient().del(key);
  }
}


import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
  ServiceUnavailableException,
} from '@nestjs/common';

import { ConfigService } from '@nestjs/config';
import { createClient, type RedisClientType } from 'redis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);

  private client?: RedisClientType<{}, {}, {}, 3, {}>;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const enabled =
      this.config.get<string>('REDIS_ENABLED') === 'true';

    if (!enabled) {
      this.logger.log('Redis disabled. Skipping connection.');
      return;
    }

    const host = this.config.get<string>('REDIS_HOST');
    const port = Number(
      this.config.get<string>('REDIS_PORT') ?? '6379',
    );
    const tls =
      this.config.get<string>('REDIS_TLS') === 'true';

    if (
      !host ||
      !Number.isInteger(port) ||
      port < 1 ||
      port > 65535
    ) {
      throw new Error('Invalid Redis host or port');
    }

    // redis:// for local Redis, rediss:// for TLS
    const protocol = tls ? 'rediss' : 'redis';

    const client = createClient({
      url: `${protocol}://${host}:${port}`,
      socket: {
        connectTimeout: 5000,
        reconnectStrategy: (retries) => {
          if (retries >= 3) {
            return false;
          }

          return Math.min(100 * 2 ** retries, 1000);
        },
      },
      disableOfflineQueue: true,
    });

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

  async onModuleDestroy(): Promise<void> {
    if (this.client?.isOpen) {
      this.client.destroy();
      this.logger.log('Redis connection closed.');
    }
  }

  private getClient(): RedisClientType<{}, {}, {}, 3, {}> {
    if (!this.client?.isReady) {
      throw new ServiceUnavailableException(
        'Redis is currently unavailable',
      );
    }

    return this.client;
  }

  async set(
    key: string,
    value: string,
    expirationSeconds?: number,
  ) {
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

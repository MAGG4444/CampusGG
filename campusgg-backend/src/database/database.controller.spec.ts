import { ServiceUnavailableException } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import { DatabaseController } from './database.controller';

describe('DatabaseController public health endpoint', () => {
  it('returns only connectivity status', async () => {
    const query = jest
      .fn()
      .mockResolvedValue([{ database: 'internal', user: 'internal' }]);
    const controller = new DatabaseController({
      query,
    } as unknown as DataSource);
    await expect(controller.testConnection()).resolves.toEqual({
      status: 'connected',
    });
    expect(query).toHaveBeenCalledWith('SELECT 1');
  });

  it('returns a sanitized 503 on query failure', async () => {
    const query = jest
      .fn()
      .mockRejectedValue(new Error('internal connection details'));
    const controller = new DatabaseController({
      query,
    } as unknown as DataSource);
    await expect(controller.testConnection()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    await expect(controller.testConnection()).rejects.toThrow(
      'Database unavailable',
    );
  });
});

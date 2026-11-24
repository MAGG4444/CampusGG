import {
  Controller,
  Get,
  Header,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';

@Controller('database')
export class DatabaseController {
  constructor(private readonly dataSource: DataSource) {}

  @Get('test')
  @Header('Cache-Control', 'no-store')
  async testConnection(): Promise<{ status: string }> {
    try {
      await this.dataSource.query('SELECT 1');
      return { status: 'connected' };
    } catch {
      throw new ServiceUnavailableException('Database unavailable');
    }
  }
}

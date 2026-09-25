import { Controller, Get } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Controller('database')
export class DatabaseController {
  constructor(private readonly dataSource: DataSource) {}

  @Get('test')
  async testConnection() {
    const result = await this.dataSource.query(`
      SELECT
        current_database() AS database,
        current_user AS user,
        NOW() AS server_time
    `);

    return {
      status: 'connected',
      ...result[0],
    };
  }
}
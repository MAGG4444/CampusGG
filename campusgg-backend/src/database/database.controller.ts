import { Controller, Get } from '@nestjs/common';
import { DataSource } from 'typeorm';

interface DatabaseQueryResult {
  database: string;
  user: string;
  server_time: string;
}

@Controller('database')
export class DatabaseController {
  constructor(private readonly dataSource: DataSource) {}

  @Get('test')
  async testConnection(): Promise<{
    status: string;
    database?: string;
    user?: string;
    server_time?: string;
  }> {
    const result = await this.dataSource.query<DatabaseQueryResult[]>(`
      SELECT
        current_database() AS database,
        current_user AS user,
        NOW() AS server_time
    `);

    const first = result[0];
    return {
      status: 'connected',
      database: first?.database,
      user: first?.user,
      server_time: first?.server_time,
    };
  }
}

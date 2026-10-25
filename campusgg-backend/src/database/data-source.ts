import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { AddUserProfile } from './migrations/add-user-profile-fields';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');

export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  schema: process.env.DATABASE_SCHEMA || 'public',
  synchronize: false,
  migrations: [AddUserProfile],
  migrationsTransactionMode: 'all',
});

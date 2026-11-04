import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { AddUserProfile1792368000000 } from './migrations/add-user-profile-fields';
import { AddUserGamingProfiles1792368002000 } from './migrations/add-user-gaming-profiles';
import { AddLobbyMessages1792368003000 } from './migrations/add-lobby-messages';
import { OneLobbyPerUser1792368004000 } from './migrations/one-lobby-per-user';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');

export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  schema: process.env.DATABASE_SCHEMA || 'public',
  synchronize: false,
  migrations: [
    AddUserProfile1792368000000,
    AddUserGamingProfiles1792368002000,
    AddLobbyMessages1792368003000,
    OneLobbyPerUser1792368004000,
  ],
  migrationsTransactionMode: 'all',
});

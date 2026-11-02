// Real PostgreSQL + HTTP fixture isolated from application records.
require('reflect-metadata');
const { randomUUID } = require('node:crypto');
const { Client } = require('pg');
const { DataSource } = require('typeorm');
const { Test } = require('@nestjs/testing');
const { ValidationPipe } = require('@nestjs/common');
const { JwtModule } = require('@nestjs/jwt');
const { getRepositoryToken } = require('@nestjs/typeorm');
const bcrypt = require('bcryptjs');
const { User } = require('../dist/users/user.entity');
const { UsersController } = require('../dist/users/users.controller');
const { UsersService } = require('../dist/users/users.service');
const { LoginController } = require('../dist/auth/login.controller');
const { LoginService } = require('../dist/auth/login.service');
const { AuthController } = require('../dist/auth/auth.controller');
const { AuthService } = require('../dist/auth/auth.service');
const { MailService } = require('../dist/auth/mail.service');
const {
  AddUserProfile1792368000000,
} = require('../dist/database/migrations/add-user-profile-fields');
const {
  AddUserGamingProfiles1792368002000,
} = require('../dist/database/migrations/add-user-gaming-profiles');

async function createFixture() {
  const url = process.env.DATABASE_URL;
  if (
    !url ||
    !['localhost', '127.0.0.1', '[::1]'].includes(new URL(url).hostname)
  ) {
    throw new Error('Profile integration tests require a local DATABASE_URL.');
  }
  const schema = `profile_test_${randomUUID().replaceAll('-', '')}`;
  const admin = new Client({ connectionString: url });
  let database;
  let app;
  let created = false;
  async function close() {
    try {
      if (app) await app.close();
      if (database?.isInitialized) await database.destroy();
    } finally {
      if (created) await admin.query(`DROP SCHEMA "${schema}" CASCADE`);
      await admin.end();
    }
  }
  try {
    await admin.connect();
    await admin.query(`CREATE SCHEMA "${schema}"`);
    created = true;
    await admin.query(`CREATE TABLE "${schema}".users (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email varchar UNIQUE NOT NULL,
      username varchar(50) UNIQUE NOT NULL, display_name varchar(100),
      edu_verified boolean NOT NULL DEFAULT false, verification_token varchar,
      token_expires_at timestamptz, password varchar,
      created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now()
    )`);
    const password = 'Profile116!Test99';
    const hash = await bcrypt.hash(password, 10);
    const accounts = [];
    for (const name of ['alice', 'bob']) {
      const account = {
        id: randomUUID(),
        email: `${name}@profile-test.edu`,
        username: name,
        password,
      };
      await admin.query(
        `INSERT INTO "${schema}".users
        (id,email,username,display_name,edu_verified,password,verification_token,token_expires_at)
        VALUES ($1,$2,$3,$3,true,$4,'private-test-token','2030-01-01')`,
        [account.id, account.email, name, hash],
      );
      accounts.push(account);
    }
    const rows = async () =>
      (await admin.query(`SELECT * FROM "${schema}".users ORDER BY username`))
        .rows;
    const before = await rows();
    await admin.query(`ALTER TABLE "${schema}".users
      ADD COLUMN bio varchar(500) NOT NULL DEFAULT '',
      ADD COLUMN favorite_games text[] NOT NULL DEFAULT '{}'::text[],
      ADD COLUMN skill_level varchar(20) NOT NULL DEFAULT '',
      ADD COLUMN preferred_roles jsonb NOT NULL DEFAULT '[]'::jsonb`);
    await admin.query(`UPDATE "${schema}".users
      SET favorite_games = ARRAY['Valorant'],
          skill_level = 'Intermediate',
          preferred_roles = '[{"game":"Valorant","roles":["Controller","Support"]}]'
      WHERE username = 'alice'`);
    database = new DataSource({
      type: 'postgres',
      url,
      schema,
      entities: [User],
      synchronize: false,
      migrations: [
        AddUserProfile1792368000000,
        AddUserGamingProfiles1792368002000,
      ],
    });
    await database.initialize();
    await database.runMigrations();
    const mail = [];
    const module = await Test.createTestingModule({
      imports: [
        JwtModule.register({
          secret: randomUUID(),
          signOptions: { expiresIn: '1h' },
        }),
      ],
      controllers: [UsersController, LoginController, AuthController],
      providers: [
        UsersService,
        LoginService,
        AuthService,
        {
          provide: getRepositoryToken(User),
          useValue: database.getRepository(User),
        },
        {
          provide: MailService,
          useValue: {
            sendVerificationEmail: async (...args) => {
              mail.push(args);
            },
          },
        },
      ],
    }).compile();
    app = module.createNestApplication({ logger: false });
    app.enableCors();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.listen(0, '127.0.0.1');
    return {
      app,
      database,
      accounts,
      before,
      rows,
      mail,
      baseUrl: await app.getUrl(),
      close,
    };
  } catch (error) {
    await close();
    throw error;
  }
}
module.exports = { createFixture };

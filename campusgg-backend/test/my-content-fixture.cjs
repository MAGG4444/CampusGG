// Isolated PostgreSQL schema; never synchronizes the application's public schema.
require('reflect-metadata');
const { randomUUID } = require('node:crypto');
const { DataSource } = require('typeorm');
const { Test } = require('@nestjs/testing');
const { getRepositoryToken } = require('@nestjs/typeorm');
const { JwtModule, JwtService } = require('@nestjs/jwt');
const { ValidationPipe } = require('@nestjs/common');
const bcrypt = require('bcryptjs');
const load = (path, name) => require(`../dist/${path}`)[name];
const User = load('users/user.entity', 'User');
const ForumPost = load('forum/forum-post.entity', 'ForumPost');
const Lobby = load('lobbies/lobby.entity', 'Lobby');
const LobbyMember = load('lobbies/lobby-member.entity', 'LobbyMember');
const entities = [User, ForumPost, Lobby, LobbyMember,
  load('forum/forum-post-like.entity', 'ForumPostLike'),
  load('forum/forum-comment.entity', 'ForumComment')];

async function createFixture() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  const schema = `test_my_content_${randomUUID().replaceAll('-', '')}`;
  const db = new DataSource({ type: 'postgres', url: process.env.DATABASE_URL, schema, entities, synchronize: false });
  await db.initialize();
  let app;
  const close = async () => {
    if (app) await app.close();
    await db.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await db.destroy();
  };
  try {
    await db.query(`CREATE SCHEMA "${schema}"`);
    await db.synchronize();
    const controllers = [
      ['forum/forum.controller', 'ForumController'],
      ['forum/forum-comments.controller', 'ForumCommentsController'],
      ['forum/forum-like-status.controller', 'ForumLikeStatusController'],
      ['lobbies/lobbies.controller', 'LobbiesController'],
      ['auth/login.controller', 'LoginController'],
      ['users/users.controller', 'UsersController'],
    ].map(([path, name]) => load(path, name));
    const services = [
      ['forum/forum.service', 'ForumService'],
      ['forum/forum-comments.service', 'ForumCommentsService'],
      ['lobbies/lobbies.service', 'LobbiesService'],
      ['auth/login.service', 'LoginService'],
      ['users/users.service', 'UsersService'],
    ].map(([path, name]) => load(path, name));
    const module = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: randomUUID(), signOptions: { expiresIn: '1h' } })],
      controllers,
      providers: [...services, ...entities.map(entity => ({ provide: getRepositoryToken(entity), useValue: db.getRepository(entity) }))],
    }).compile();
    app = module.createNestApplication({ logger: false });
    app.enableCors();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.listen(0, '127.0.0.1');
    const password = 'Disposable117!';
    const users = await db.getRepository(User).save(['a', 'b', 'empty'].map(name => ({
      email: `issue117-${name}@example.edu`, username: `issue117_${name}`,
      displayName: 'Same Display Name', eduVerified: true, password: bcrypt.hashSync(password, 4),
    })));
    const [a, b] = users;
    const posts = await db.getRepository(ForumPost).save([
      { author: a, title: 'Older post', content: 'Older preview', createdAt: new Date('2026-01-01') },
      { author: a, title: 'Newer post', content: 'Preview '.repeat(100), createdAt: new Date('2026-02-01') },
      { author: b, title: 'Other author post', content: 'Not owned by A' },
    ]);
    const lobbies = await db.getRepository(Lobby).save([
      { host: a, lobbyName: 'Older hosted lobby', details: 'My older lobby', tags: [], visibility: 'public', createdAt: new Date('2026-01-01') },
      { host: a, lobbyName: 'Newer private hosted lobby', details: 'My private lobby', tags: [], visibility: 'private', createdAt: new Date('2026-02-01') },
      { host: b, lobbyName: 'Joined only lobby', details: 'Hosted by B', tags: [], visibility: 'public' },
    ]);
    await db.getRepository(LobbyMember).save([
      ...lobbies.map(lobby => ({ lobby, user: lobby.host, role: 'host' })),
      { lobby: lobbies[2], user: a, role: 'member' },
    ]);
    const jwt = module.get(JwtService);
    return { app, db, users, posts, lobbies, password, jwt, close,
      url: await app.getUrl(), tokens: users.map(user => jwt.sign({ sub: user.id })) };
  } catch (error) { await close(); throw error; }
}
module.exports = { createFixture, ForumPost };

if (require.main === module) {
  createFixture().then(fixture => {
    console.log(JSON.stringify({ url: fixture.url, email: fixture.users[0].email, password: fixture.password }));
    for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, async () => { await fixture.close(); process.exit(0); });
  }).catch(error => { console.error(error); process.exitCode = 1; });
}

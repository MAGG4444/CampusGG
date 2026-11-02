const test = require('node:test');
const assert = require('node:assert/strict');
const { JwtService } = require('@nestjs/jwt');
const { createFixture } = require('./profile-fixture.cjs');

test('profile API persists authenticated game-specific preferences', async (t) => {
  const fixture = await createFixture();
  t.after(() => fixture.close());
  const [alice, bob] = fixture.accounts;
  async function request(path, { token, method = 'GET', body } = {}) {
    const response = await fetch(`${fixture.baseUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, data: await response.json() };
  }
  async function login(account) {
    const result = await request('/api/auth/login', {
      method: 'POST',
      body: { email: account.email, password: account.password },
    });
    assert.equal(result.status, 200);
    return result.data.access_token;
  }
  const token = await login(alice);
  const patch = (body, auth = token) =>
    request('/users/me', { method: 'PATCH', token: auth, body });

  await t.test(
    'migrations preserve account columns and supply safe defaults',
    async () => {
      const after = await fixture.rows();
      for (let index = 0; index < after.length; index += 1) {
        const { bio, gaming_profiles, ...original } = after[index];
        assert.deepEqual(original, fixture.before[index]);
        assert.equal(bio, '');
        assert.deepEqual(
          gaming_profiles,
          after[index].username === 'alice'
            ? [
                {
                  game: 'Valorant',
                  preferredRoles: ['Controller'],
                  experienceLevel: 'Intermediate',
                },
              ]
            : [],
        );
      }
      assert.deepEqual(await fixture.database.runMigrations(), []);
    },
  );

  await t.test(
    'JWT ownership and strict allowlisting protect account data',
    async () => {
      const expired = fixture.app
        .get(JwtService)
        .sign({ sub: alice.id }, { expiresIn: -1 });
      for (const auth of ['', 'invalid', expired]) {
        assert.equal((await patch({ bio: 'Denied' }, auth)).status, 401);
        assert.equal((await request('/users/me', { token: auth })).status, 401);
      }
      for (const key of [
        'id',
        'userId',
        'username',
        'email',
        'password',
        'eduVerified',
        'verificationToken',
      ]) {
        assert.equal(
          (await patch({ bio: 'Must not save', [key]: bob.id })).status,
          400,
          key,
        );
      }
    },
  );

  const profile = {
    displayName: 'Campus Player',
    bio: 'Weekend squad',
    gamingProfiles: [
      {
        game: 'Valorant',
        preferredRoles: ['Controller', 'Sentinel'],
        experienceLevel: 'Intermediate',
      },
      {
        game: 'Minecraft',
        preferredRoles: ['Strategist'],
        experienceLevel: 'Advanced',
      },
    ],
  };

  await t.test(
    'validated updates persist roles only for the JWT owner',
    async () => {
      const result = await patch(profile);
      assert.equal(result.status, 200);
      assert.deepEqual(result.data, {
        id: alice.id,
        username: alice.username,
        email: alice.email,
        ...profile,
      });
      const other = (await fixture.rows()).find((row) => row.id === bob.id);
      assert.deepEqual(other.gaming_profiles, []);
      assert.equal(
        (
          await patch({
            gamingProfiles: [
              {
                game: 'Valorant',
                preferredRoles: ['Support'],
                experienceLevel: 'Beginner',
              },
            ],
          })
        ).status,
        400,
      );
    },
  );

  await t.test(
    'games can be removed without affecting remaining preferences',
    async () => {
      const result = await patch({
        gamingProfiles: [profile.gamingProfiles[1]],
      });
      assert.equal(result.status, 200);
      assert.deepEqual(result.data.gamingProfiles, [profile.gamingProfiles[1]]);
      await patch(profile);
    },
  );

  await t.test(
    'nested gaming profile validation rejects malformed data',
    async () => {
      const invalidPayloads = [
        { gamingProfiles: {} },
        {
          gamingProfiles: [
            {
              game: 'Valorant',
              preferredRoles: 'Controller',
              experienceLevel: 'Intermediate',
            },
          ],
        },
        {
          gamingProfiles: [
            {
              game: 'Valorant',
              preferredRoles: ['Controller'],
              experienceLevel: 'Expert',
            },
          ],
        },
        {
          gamingProfiles: [
            profile.gamingProfiles[0],
            { ...profile.gamingProfiles[0], game: ' valorant ' },
          ],
        },
        {
          gamingProfiles: [
            { ...profile.gamingProfiles[0], lobbyPosition: 'Leader' },
          ],
        },
      ];

      for (const body of invalidPayloads) {
        assert.equal((await patch(body)).status, 400);
      }
      assert.deepEqual(
        (await request('/users/me', { token })).data.gamingProfiles,
        profile.gamingProfiles,
      );
    },
  );

  await t.test(
    'fresh login reads persistence and public profiles omit email',
    async () => {
      const refreshed = await request('/users/me', {
        token: await login(alice),
      });
      assert.deepEqual(refreshed.data, {
        id: alice.id,
        username: alice.username,
        email: alice.email,
        ...profile,
      });
      const publicProfile = (await request(`/users/${alice.id}`)).data;
      assert.deepEqual(publicProfile, {
        id: alice.id,
        username: alice.username,
        ...profile,
      });
    },
  );

  await t.test(
    'registration and verification retain empty profile defaults',
    async () => {
      const account = {
        email: 'new@profile-test.edu',
        username: 'newplayer',
        displayName: 'New Player',
        password: alice.password,
      };
      assert.equal(
        (await request('/api/auth/register', { method: 'POST', body: account }))
          .status,
        201,
      );
      const code = fixture.mail.at(-1)[2];
      assert.match(code, /^\d{6}$/);
      assert.equal(
        (
          await request('/api/auth/verify', {
            method: 'POST',
            body: { email: account.email, code },
          })
        ).status,
        200,
      );
      const user = (await request('/users/me', { token: await login(account) }))
        .data;
      assert.equal(user.bio, '');
      assert.deepEqual(user.gamingProfiles, []);
    },
  );
});

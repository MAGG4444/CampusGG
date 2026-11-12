import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

// @nestjs/jwt ships as ESM, which this CommonJS Jest setup cannot load.
// This double implements just enough HS256 JWT for the state-token tests.
jest.mock('@nestjs/jwt', () => {
  const { createHmac, timingSafeEqual } = require('node:crypto');

  const encode = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString('base64url');

  const durationSeconds = (value: string | number): number => {
    if (typeof value === 'number') return value;
    const match = /^(\d+)\s*([smhd])$/.exec(value);
    if (!match) throw new Error(`Unsupported duration: ${value}`);
    const units: Record<string, number> = {
      s: 1,
      m: 60,
      h: 3600,
      d: 86400,
    };
    return Number(match[1]) * units[match[2]];
  };

  class JwtService {
    constructor(private readonly options: { secret?: string } = {}) {}

    async signAsync(
      payload: Record<string, unknown>,
      options: { secret?: string; expiresIn?: string | number } = {},
    ): Promise<string> {
      const secret = options.secret ?? this.options.secret;
      if (!secret) throw new Error('JWT secret is required');

      const now = Math.floor(Date.now() / 1000);
      const claims: Record<string, unknown> = { ...payload, iat: now };

      if (options.expiresIn !== undefined) {
        claims.exp = now + durationSeconds(options.expiresIn);
      }

      const header = encode({ alg: 'HS256', typ: 'JWT' });
      const body = encode(claims);
      const signature = createHmac('sha256', secret)
        .update(`${header}.${body}`)
        .digest('base64url');

      return `${header}.${body}.${signature}`;
    }

    async verifyAsync<T>(
      token: string,
      options: { secret?: string } = {},
    ): Promise<T> {
      const secret = options.secret ?? this.options.secret;
      if (!secret) throw new Error('JWT secret is required');

      const [header, body, signature] = token.split('.');
      if (!header || !body || !signature) {
        throw new Error('Malformed token');
      }

      const expected = createHmac('sha256', secret)
        .update(`${header}.${body}`)
        .digest();
      const actual = Buffer.from(signature, 'base64url');

      if (
        actual.length !== expected.length ||
        !timingSafeEqual(actual, expected)
      ) {
        throw new Error('Invalid signature');
      }

      const payload = JSON.parse(
        Buffer.from(body, 'base64url').toString('utf8'),
      ) as Record<string, unknown>;

      if (
        typeof payload.exp === 'number' &&
        payload.exp <= Math.floor(Date.now() / 1000)
      ) {
        throw new Error('Token expired');
      }

      return payload as T;
    }
  }

  return { JwtService };
});

import { SteamOpenIdService } from './steam-openid.service';

const APP_BASE_URL = 'http://localhost:3000';
const JWT_SECRET = 'test-secret';
const STATE_SECRET = `${JWT_SECRET}:steam-link-state`;
const STEAM_ID = '76561198000000000';
const OPENID_NAMESPACE = 'http://specs.openid.net/auth/2.0';

type CallbackQuery = Record<string, string | string[]>;

function createConfig(): ConfigService {
  return new ConfigService({
    APP_BASE_URL,
    JWT_SECRET,
  });
}

describe('SteamOpenIdService', () => {
  const jwtService = new JwtService({ secret: JWT_SECRET });
  let service: SteamOpenIdService;
  let fetchMock: jest.SpyInstance;

  beforeEach(() => {
    service = new SteamOpenIdService(createConfig(), jwtService);
    fetchMock = jest.spyOn(globalThis, 'fetch');
    fetchMock.mockResolvedValue(
      new Response(
        'ns:http://specs.openid.net/auth/2.0\nis_valid:true',
        { status: 200 },
      ),
    );
  });

  afterEach(() => {
    fetchMock.mockRestore();
  });

  async function validQuery(
    overrides: Record<string, string> = {},
  ): Promise<CallbackQuery> {
    const state = await jwtService.signAsync(
      { purpose: 'steam_link', userId: 'user-1' },
      { secret: STATE_SECRET, expiresIn: '10m' },
    );
    const returnTo = `${APP_BASE_URL}/steam/callback?state=${encodeURIComponent(state)}`;

    return {
      state,
      'openid.ns': OPENID_NAMESPACE,
      'openid.mode': 'id_res',
      'openid.op_endpoint':
        'https://steamcommunity.com/openid/login',
      'openid.return_to': returnTo,
      'openid.claimed_id': `https://steamcommunity.com/openid/id/${STEAM_ID}`,
      'openid.identity': `https://steamcommunity.com/openid/id/${STEAM_ID}`,
      'openid.response_nonce': '2026-11-08T00:00:00Znonce',
      'openid.assoc_handle': '1234567890',
      'openid.signed':
        'signed,op_endpoint,claimed_id,identity,return_to,response_nonce,assoc_handle',
      'openid.sig': 'signature',
      ...overrides,
    };
  }

  it('builds a checkid_setup URL with a signed, user-bound state', async () => {
    const { url } = await service.createLinkUrl('user-1');
    const parsed = new URL(url);

    expect(parsed.origin + parsed.pathname).toBe(
      'https://steamcommunity.com/openid/login',
    );
    expect(parsed.searchParams.get('openid.mode')).toBe('checkid_setup');
    expect(parsed.searchParams.get('openid.ns')).toBe(
      OPENID_NAMESPACE,
    );
    expect(parsed.searchParams.get('openid.realm')).toBe(APP_BASE_URL);
    expect(parsed.searchParams.get('openid.identity')).toBe(
      `${OPENID_NAMESPACE}/identifier_select`,
    );

    const returnTo = parsed.searchParams.get('openid.return_to');
    expect(returnTo).toBeTruthy();

    const state = new URL(returnTo!).searchParams.get('state');
    expect(state).toBeTruthy();

    const payload = await jwtService.verifyAsync<{
      purpose: string;
      userId: string;
    }>(state!, { secret: STATE_SECRET });

    expect(payload).toMatchObject({
      purpose: 'steam_link',
      userId: 'user-1',
    });
    expect(payload).not.toHaveProperty('sub');
  });

  it('verifies a valid callback and posts check_authentication to Steam', async () => {
    const query = await validQuery();

    await expect(service.verifyCallback(query)).resolves.toEqual({
      userId: 'user-1',
      steamId: STEAM_ID,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, options] = fetchMock.mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(url).toBe('https://steamcommunity.com/openid/login');
    expect(options.method).toBe('POST');

    const body = new URLSearchParams(String(options.body));
    expect(body.get('openid.mode')).toBe('check_authentication');
    expect(body.get('openid.claimed_id')).toBe(
      `https://steamcommunity.com/openid/id/${STEAM_ID}`,
    );
    expect(body.get('state')).toBeNull();
  });

  it('rejects a callback Steam marks invalid', async () => {
    fetchMock.mockResolvedValue(
      new Response('ns:http://specs.openid.net/auth/2.0\nis_valid:false', {
        status: 200,
      }),
    );

    await expect(
      service.verifyCallback(await validQuery()),
    ).rejects.toMatchObject({ reason: 'steam_validation_failed' });
  });

  it('rejects an unexpected OpenID provider without calling Steam', async () => {
    const query = await validQuery({
      'openid.op_endpoint': 'https://evil.example/openid',
    });

    await expect(service.verifyCallback(query)).rejects.toMatchObject({
      reason: 'invalid_openid',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a return_to that does not match the configured callback', async () => {
    const query = await validQuery();
    query['openid.return_to'] =
      `${APP_BASE_URL}/steam/callback?state=wrong`;

    await expect(service.verifyCallback(query)).rejects.toMatchObject({
      reason: 'invalid_openid',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a malformed Steam ID', async () => {
    const query = await validQuery({
      'openid.claimed_id':
        'https://steamcommunity.com/openid/id/123',
      'openid.identity':
        'https://steamcommunity.com/openid/id/123',
    });

    await expect(service.verifyCallback(query)).rejects.toMatchObject({
      reason: 'invalid_steam_id',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects duplicate OpenID parameters', async () => {
    const query = await validQuery();
    query['openid.claimed_id'] = [
      `https://steamcommunity.com/openid/id/${STEAM_ID}`,
      `https://steamcommunity.com/openid/id/${STEAM_ID}`,
    ];

    await expect(service.verifyCallback(query)).rejects.toMatchObject({
      reason: 'invalid_openid',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a missing state', async () => {
    const query = await validQuery();
    delete query.state;

    await expect(service.verifyCallback(query)).rejects.toMatchObject({
      reason: 'invalid_state',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a state signed for another purpose', async () => {
    const state = await jwtService.signAsync(
      { purpose: 'access', userId: 'user-1' },
      { secret: STATE_SECRET, expiresIn: '10m' },
    );
    const query = await validQuery();
    query.state = state;
    query['openid.return_to'] =
      `${APP_BASE_URL}/steam/callback?state=${encodeURIComponent(state)}`;

    await expect(service.verifyCallback(query)).rejects.toMatchObject({
      reason: 'invalid_state',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('handles a cancelled Steam login', async () => {
    const query = await validQuery({ 'openid.mode': 'cancel' });

    await expect(service.verifyCallback(query)).rejects.toMatchObject({
      reason: 'cancelled',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

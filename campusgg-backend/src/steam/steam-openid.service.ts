import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

import { SteamLinkError } from './steam-link.error';

const STEAM_OPENID_ENDPOINT = 'https://steamcommunity.com/openid/login';
const OPENID_NAMESPACE = 'http://specs.openid.net/auth/2.0';
const STEAM_ID_PATTERN =
  /^https?:\/\/steamcommunity\.com\/openid\/id\/(\d{17})$/;
const STATE_TTL = '10m';
const CALLBACK_PATH = '/steam/callback';

export type SteamCallbackQuery = Record<
  string,
  string | string[] | undefined
>;

interface SteamLinkState {
  purpose?: unknown;
  userId?: unknown;
}

/**
 * Owns the Steam OpenID 2.0 handshake. The state token is intentionally
 * signed with a derived secret and does not use the `sub` claim, so it can
 * never be accepted by JwtAuthGuard as an access token.
 */
@Injectable()
export class SteamOpenIdService {
  private readonly logger = new Logger(SteamOpenIdService.name);
  private readonly appBaseUrl: string;
  private readonly stateSecret: string;

  constructor(
    private readonly config: ConfigService,
    private readonly jwtService: JwtService,
  ) {
    this.appBaseUrl = this.normalizeBaseUrl(
      this.config.getOrThrow<string>('APP_BASE_URL'),
    );
    this.stateSecret = `${this.config.getOrThrow<string>('JWT_SECRET')}:steam-link-state`;
  }

  async createLinkUrl(userId: string): Promise<{ url: string }> {
    const state = await this.jwtService.signAsync(
      { purpose: 'steam_link', userId },
      { secret: this.stateSecret, expiresIn: STATE_TTL },
    );

    const returnTo = new URL(CALLBACK_PATH, this.appBaseUrl);
    returnTo.searchParams.set('state', state);

    const params = new URLSearchParams({
      'openid.ns': OPENID_NAMESPACE,
      'openid.mode': 'checkid_setup',
      'openid.return_to': returnTo.toString(),
      'openid.realm': this.appBaseUrl,
      'openid.identity': `${OPENID_NAMESPACE}/identifier_select`,
      'openid.claimed_id': `${OPENID_NAMESPACE}/identifier_select`,
    });

    return { url: `${STEAM_OPENID_ENDPOINT}?${params.toString()}` };
  }

  async verifyCallback(
    query: SteamCallbackQuery,
  ): Promise<{ userId: string; steamId: string }> {
    const params = this.normalizeQuery(query);

    const state = params['state'];
    if (!state) {
      throw new SteamLinkError(
        'invalid_state',
        'Missing Steam link state',
      );
    }

    const userId = await this.verifyState(state);

    if (params['openid.mode'] === 'cancel') {
      throw new SteamLinkError('cancelled', 'Steam login was cancelled');
    }

    if (params['openid.mode'] !== 'id_res') {
      throw new SteamLinkError(
        'invalid_openid',
        'Unexpected OpenID response mode',
      );
    }

    if (params['openid.ns'] !== OPENID_NAMESPACE) {
      throw new SteamLinkError(
        'invalid_openid',
        'Unexpected OpenID namespace',
      );
    }

    if (params['openid.op_endpoint'] !== STEAM_OPENID_ENDPOINT) {
      throw new SteamLinkError(
        'invalid_openid',
        'Unexpected OpenID provider',
      );
    }

    this.assertReturnTo(params['openid.return_to'], state);

    const steamId = this.extractSteamId(
      params['openid.claimed_id'],
      params['openid.identity'],
    );

    await this.checkAuthentication(params);

    return { userId, steamId };
  }

  private normalizeQuery(
    query: SteamCallbackQuery,
  ): Record<string, string> {
    const normalized: Record<string, string> = {};

    for (const [key, value] of Object.entries(query)) {
      if (typeof value !== 'string') {
        throw new SteamLinkError(
          'invalid_openid',
          `Duplicate or invalid OpenID parameter: ${key}`,
        );
      }

      normalized[key] = value;
    }

    return normalized;
  }

  private async verifyState(state: string): Promise<string> {
    let payload: SteamLinkState;

    try {
      payload = await this.jwtService.verifyAsync<SteamLinkState>(state, {
        secret: this.stateSecret,
      });
    } catch {
      throw new SteamLinkError(
        'invalid_state',
        'Invalid or expired Steam link state',
      );
    }

    if (
      payload.purpose !== 'steam_link' ||
      typeof payload.userId !== 'string' ||
      payload.userId.length === 0
    ) {
      throw new SteamLinkError(
        'invalid_state',
        'Invalid Steam link state',
      );
    }

    return payload.userId;
  }

  private assertReturnTo(returnTo: string | undefined, state: string): void {
    if (!returnTo) {
      throw new SteamLinkError(
        'invalid_openid',
        'Missing OpenID return_to parameter',
      );
    }

    let actual: URL;
    let expected: URL;

    try {
      actual = new URL(returnTo);
      expected = new URL(CALLBACK_PATH, this.appBaseUrl);
      expected.searchParams.set('state', state);
    } catch {
      throw new SteamLinkError(
        'invalid_openid',
        'Invalid OpenID return_to parameter',
      );
    }

    if (
      actual.origin !== expected.origin ||
      actual.pathname !== expected.pathname ||
      actual.searchParams.get('state') !== state
    ) {
      throw new SteamLinkError(
        'invalid_openid',
        'OpenID return_to does not match this CampusGG callback',
      );
    }
  }

  private extractSteamId(
    claimedId: string | undefined,
    identity: string | undefined,
  ): string {
    const claimedMatch = claimedId
      ? STEAM_ID_PATTERN.exec(claimedId)
      : null;
    const identityMatch = identity
      ? STEAM_ID_PATTERN.exec(identity)
      : null;

    if (!claimedMatch || !identityMatch) {
      throw new SteamLinkError(
        'invalid_steam_id',
        'Steam did not return a valid account ID',
      );
    }

    if (claimedMatch[1] !== identityMatch[1]) {
      throw new SteamLinkError(
        'invalid_steam_id',
        'Steam returned mismatched account identifiers',
      );
    }

    return claimedMatch[1];
  }

  private async checkAuthentication(
    params: Record<string, string>,
  ): Promise<void> {
    const body = new URLSearchParams();

    for (const [key, value] of Object.entries(params)) {
      if (key.startsWith('openid.') && key !== 'openid.mode') {
        body.set(key, value);
      }
    }

    body.set('openid.mode', 'check_authentication');

    let response: Response;

    try {
      response = await fetch(STEAM_OPENID_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw new SteamLinkError(
        'steam_validation_failed',
        'Could not reach Steam to validate the OpenID assertion',
      );
    }

    if (!response.ok) {
      this.logger.warn(
        `Steam OpenID validation returned HTTP ${response.status}`,
      );
      throw new SteamLinkError(
        'steam_validation_failed',
        'Steam could not validate the OpenID assertion',
      );
    }

    const text = await response.text();
    const isValid = text
      .split(/\r?\n/)
      .some((line) => line.trim() === 'is_valid:true');

    if (!isValid) {
      this.logger.warn('Steam OpenID validation returned is_valid:false');
      throw new SteamLinkError(
        'steam_validation_failed',
        'Steam rejected the OpenID assertion',
      );
    }
  }

  private normalizeBaseUrl(value: string): string {
    return value.replace(/\/+$/, '');
  }
}

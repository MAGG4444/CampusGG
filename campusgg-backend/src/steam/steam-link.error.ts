/**
 * Expected Steam-link failures. The callback route uses these reasons to
 * redirect the browser back to the profile page with a stable error code
 * instead of rendering a JSON exception.
 */
export type SteamLinkErrorReason =
  | 'cancelled'
  | 'invalid_state'
  | 'invalid_openid'
  | 'steam_validation_failed'
  | 'invalid_steam_id'
  | 'already_linked'
  | 'user_not_found'
  | 'unexpected';

export class SteamLinkError extends Error {
  constructor(
    readonly reason: SteamLinkErrorReason,
    message: string,
  ) {
    super(message);
    this.name = 'SteamLinkError';
  }
}

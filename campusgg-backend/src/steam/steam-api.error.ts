/** Raised when the Steam Web API cannot provide a usable response. */
export class SteamApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SteamApiError';
  }
}

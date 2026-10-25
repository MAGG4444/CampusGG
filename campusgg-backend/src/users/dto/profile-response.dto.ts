import { User } from '../user.entity';

/** Explicit allowlist shared by the public profile routes. */
export class PublicProfileDto {
  id: string;
  username: string;
  displayName: string;
  bio: string;
  favoriteGames: string[];
  skillLevel: string;

  constructor(user: User) {
    this.id = user.id;
    this.username = user.username;
    this.displayName = user.displayName;
    this.bio = user.bio ?? '';
    this.favoriteGames = user.favoriteGames ?? [];
    this.skillLevel = user.skillLevel ?? '';
  }
}

/** Private account information is returned only to the authenticated owner. */
export class ProfileResponseDto extends PublicProfileDto {
  email: string;

  constructor(user: User) {
    super(user);
    this.email = user.email;
  }
}

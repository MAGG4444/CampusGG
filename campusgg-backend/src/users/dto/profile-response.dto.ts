import { User } from '../user.entity';

/** Explicit allowlist shared by public profile routes. */
export class PublicProfileDto {
  id: string;
  username: string;
  displayName: string;
  bio: string;
  gamingProfiles: Array<{
    game: string;
    preferredRoles: string[];
    experienceLevel: string;
  }>;

  constructor(user: User) {
    this.id = user.id;
    this.username = user.username;
    this.displayName = user.displayName;
    this.bio = user.bio ?? '';
    this.gamingProfiles = (user.gamingProfiles ?? []).map((profile) => ({
      game: profile.game,
      preferredRoles: [...profile.preferredRoles],
      experienceLevel: profile.experienceLevel,
    }));
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

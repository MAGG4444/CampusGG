import { findGamingProfile, roleNounForGame } from '../common/games.config';
import type { GamingProfile } from '../users/user.entity';
import {
  SUGGESTED_USER_ROLE_MODE,
  SUGGESTED_USER_LIMIT,
  SUGGESTED_USER_WEIGHTS,
  type SuggestedUserRoleMode,
} from './recommendation.config';
import {
  campusDomainFromEmail,
  campusFit,
  fitLabel,
  roundScore,
  selectWithCampusDiversity,
  skillFit,
  uniqueRoles,
  type FitLabel,
} from './scoring.utils';

export interface SuggestedUserCandidate {
  id: string;
  username: string;
  displayName?: string | null;
  bio?: string | null;
  email?: string | null;
  campusDomain?: string | null;
  gamingProfiles?: GamingProfile[];
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

export interface SuggestedUserViewer {
  email?: string | null;
  campusDomain?: string | null;
  gamingProfiles?: GamingProfile[];
}

export interface SuggestedRoleFit {
  value: number;
  complementary: boolean;
  overlaps: boolean;
  /** Candidate roles the viewer does not play, in profile order. */
  complementaryRoles: string[];
  /** Candidate roles the viewer also plays, in profile order. */
  sharedRoles: string[];
  complementaryRoleCount: number;
  sharedRoleCount: number;
  sharedRoleRatio: number;
}

export interface SuggestedUserTieBreak {
  complementaryRoleCount: number;
  sharedRoleCount: number;
  sharedRoleRatio: number;
  /** Latest known profile activity, used only for deterministic ordering. */
  activityAt: number;
  /** Internal only; never serialized in recommendation responses. */
  campusDomain: string | null;
}

export interface ScoredSuggestedUser {
  user: SuggestedUserCandidate;
  score: number;
  fit: FitLabel;
  reasons: string[];
  profile: {
    game: string;
    experienceLevel: string | null;
    preferredRoles: string[];
  } | null;
  parts: {
    skillFit: number;
    roleFit: number;
    campusFit: number;
  };
  tieBreak: SuggestedUserTieBreak;
}

function roleKey(role: string): string {
  return role.trim().toLowerCase();
}

/** Role compatibility; missing role data stays neutral. */
export function suggestedRoleFit(
  viewerRoles: readonly string[],
  candidateRoles: readonly string[],
  mode: SuggestedUserRoleMode,
): SuggestedRoleFit {
  const viewer = uniqueRoles(viewerRoles).map(roleKey);
  const candidate = uniqueRoles(candidateRoles);
  if (viewer.length === 0 || candidate.length === 0) {
    return {
      value: 0.5,
      complementary: false,
      overlaps: false,
      complementaryRoles: [],
      sharedRoles: [],
      complementaryRoleCount: 0,
      sharedRoleCount: 0,
      sharedRoleRatio: 0,
    };
  }
  const viewerSet = new Set(viewer);
  const sharedRoles = candidate.filter((role) => viewerSet.has(roleKey(role)));
  const complementaryRoles = candidate.filter(
    (role) => !viewerSet.has(roleKey(role)),
  );
  const sharedRoleCount = sharedRoles.length;
  const complementaryRoleCount = complementaryRoles.length;
  const sharedRoleRatio = sharedRoleCount / candidate.length;
  const overlaps = sharedRoleCount > 0;
  const complementary = complementaryRoleCount > 0;

  if (mode === 'overlap') {
    return {
      value: overlaps ? 1 : 0.2,
      complementary,
      overlaps,
      complementaryRoles,
      sharedRoles,
      complementaryRoleCount,
      sharedRoleCount,
      sharedRoleRatio,
    };
  }
  return {
    value: complementary ? 1 : 0.6,
    complementary,
    overlaps,
    complementaryRoles,
    sharedRoles,
    complementaryRoleCount,
    sharedRoleCount,
    sharedRoleRatio,
  };
}

function latestActivityAt(candidate: SuggestedUserCandidate): number {
  return Math.max(
    candidate.updatedAt?.getTime() ?? 0,
    candidate.createdAt?.getTime() ?? 0,
  );
}

export function scoreSuggestedUser(
  candidate: SuggestedUserCandidate,
  viewer: SuggestedUserViewer,
  game: string,
  mode: SuggestedUserRoleMode = SUGGESTED_USER_ROLE_MODE,
): ScoredSuggestedUser {
  const viewerProfile = findGamingProfile(viewer.gamingProfiles, game);
  const candidateProfile = findGamingProfile(candidate.gamingProfiles, game);
  const viewerDomain =
    viewer.campusDomain ?? campusDomainFromEmail(viewer.email);
  const candidateDomain =
    candidate.campusDomain ?? campusDomainFromEmail(candidate.email);

  const parts = {
    skillFit: skillFit(
      viewerProfile?.experienceLevel,
      candidateProfile?.experienceLevel,
    ),
    roleFit: suggestedRoleFit(
      viewerProfile?.preferredRoles ?? [],
      candidateProfile?.preferredRoles ?? [],
      mode,
    ),
    campusFit: campusFit(viewerDomain, candidateDomain),
  };
  const reasons: string[] = [];
  const roleNoun = roleNounForGame(game);

  if (mode === 'overlap' && parts.roleFit.sharedRoleCount > 0) {
    reasons.push(`Shares ${parts.roleFit.sharedRoles.join(' + ')}`);
    if (parts.roleFit.complementaryRoleCount > 0) {
      reasons.push(
        `Also plays ${parts.roleFit.complementaryRoles.join(' + ')}`,
      );
    }
  } else if (
    mode === 'complement' &&
    parts.roleFit.complementaryRoleCount > 0
  ) {
    reasons.push(
      `Brings ${parts.roleFit.complementaryRoles.join(' + ')} — you don't play them`,
    );
    if (parts.roleFit.sharedRoleCount > 0) {
      reasons.push(`Also plays ${parts.roleFit.sharedRoles.join(' + ')}`);
    }
  } else if (mode === 'complement' && parts.roleFit.sharedRoleCount > 0) {
    reasons.push(
      `Plays the same ${roleNoun}s: ${parts.roleFit.sharedRoles.join(' + ')}`,
    );
  }

  if (parts.skillFit === 1 && candidateProfile?.experienceLevel) {
    reasons.push(`Same skill level: ${candidateProfile.experienceLevel}`);
  }

  if (parts.campusFit === 1) reasons.push('Same campus');

  const score =
    SUGGESTED_USER_WEIGHTS.skillFit * parts.skillFit +
    SUGGESTED_USER_WEIGHTS.roleFit * parts.roleFit.value +
    SUGGESTED_USER_WEIGHTS.campusFit * parts.campusFit;

  return {
    user: candidate,
    score: roundScore(score),
    fit: fitLabel(score),
    reasons: reasons.slice(0, 3),
    profile: candidateProfile
      ? {
          game: candidateProfile.game,
          experienceLevel: candidateProfile.experienceLevel ?? null,
          preferredRoles: [...candidateProfile.preferredRoles],
        }
      : null,
    parts: {
      skillFit: parts.skillFit,
      roleFit: parts.roleFit.value,
      campusFit: parts.campusFit,
    },
    tieBreak: {
      complementaryRoleCount: parts.roleFit.complementaryRoleCount,
      sharedRoleCount: parts.roleFit.sharedRoleCount,
      sharedRoleRatio: parts.roleFit.sharedRoleRatio,
      activityAt: latestActivityAt(candidate),
      campusDomain: candidateDomain,
    },
  };
}

function compareSuggestedUsers(
  a: ScoredSuggestedUser,
  b: ScoredSuggestedUser,
  mode: SuggestedUserRoleMode,
): number {
  if (b.score !== a.score) return b.score - a.score;

  if (mode === 'overlap') {
    if (b.tieBreak.sharedRoleRatio !== a.tieBreak.sharedRoleRatio) {
      return b.tieBreak.sharedRoleRatio - a.tieBreak.sharedRoleRatio;
    }
    if (b.tieBreak.sharedRoleCount !== a.tieBreak.sharedRoleCount) {
      return b.tieBreak.sharedRoleCount - a.tieBreak.sharedRoleCount;
    }
    if (
      b.tieBreak.complementaryRoleCount !== a.tieBreak.complementaryRoleCount
    ) {
      return (
        b.tieBreak.complementaryRoleCount - a.tieBreak.complementaryRoleCount
      );
    }
  } else {
    if (
      b.tieBreak.complementaryRoleCount !== a.tieBreak.complementaryRoleCount
    ) {
      return (
        b.tieBreak.complementaryRoleCount - a.tieBreak.complementaryRoleCount
      );
    }
    // Prefer the purer complement when both candidates fill the same number
    // of new roles.
    if (a.tieBreak.sharedRoleRatio !== b.tieBreak.sharedRoleRatio) {
      return a.tieBreak.sharedRoleRatio - b.tieBreak.sharedRoleRatio;
    }
    if (a.tieBreak.sharedRoleCount !== b.tieBreak.sharedRoleCount) {
      return a.tieBreak.sharedRoleCount - b.tieBreak.sharedRoleCount;
    }
  }

  if (b.tieBreak.activityAt !== a.tieBreak.activityAt) {
    return b.tieBreak.activityAt - a.tieBreak.activityAt;
  }
  return a.user.username.localeCompare(b.user.username);
}

/** Campus is excluded here so diversity is only applied to true rank ties. */
function sameSuggestedUserRank(
  a: ScoredSuggestedUser,
  b: ScoredSuggestedUser,
  mode: SuggestedUserRoleMode,
): boolean {
  if (a.score !== b.score || a.tieBreak.activityAt !== b.tieBreak.activityAt) {
    return false;
  }
  if (mode === 'overlap') {
    return (
      a.tieBreak.sharedRoleRatio === b.tieBreak.sharedRoleRatio &&
      a.tieBreak.sharedRoleCount === b.tieBreak.sharedRoleCount &&
      a.tieBreak.complementaryRoleCount === b.tieBreak.complementaryRoleCount
    );
  }
  return (
    a.tieBreak.complementaryRoleCount === b.tieBreak.complementaryRoleCount &&
    a.tieBreak.sharedRoleRatio === b.tieBreak.sharedRoleRatio &&
    a.tieBreak.sharedRoleCount === b.tieBreak.sharedRoleCount
  );
}

export function rankSuggestedUsers(
  candidates: readonly SuggestedUserCandidate[],
  viewer: SuggestedUserViewer,
  game: string,
  options: { limit?: number; mode?: SuggestedUserRoleMode } = {},
): ScoredSuggestedUser[] {
  const mode = options.mode ?? SUGGESTED_USER_ROLE_MODE;
  const limit = options.limit ?? SUGGESTED_USER_LIMIT;
  const ranked = candidates
    .map((candidate) => scoreSuggestedUser(candidate, viewer, game, mode))
    .sort((a, b) => compareSuggestedUsers(a, b, mode));

  return selectWithCampusDiversity(
    ranked,
    limit,
    (item) => item.tieBreak.campusDomain,
    (a, b) => sameSuggestedUserRank(a, b, mode),
  );
}

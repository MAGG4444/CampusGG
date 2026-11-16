import { findGamingProfile } from '../common/games.config';
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
}

export interface SuggestedUserViewer {
  email?: string | null;
  campusDomain?: string | null;
  gamingProfiles?: GamingProfile[];
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
}

function roleKey(role: string): string {
  return role.trim().toLowerCase();
}

/** Role compatibility; missing role data stays neutral. */
export function suggestedRoleFit(
  viewerRoles: readonly string[],
  candidateRoles: readonly string[],
  mode: SuggestedUserRoleMode,
): { value: number; complementary: boolean; overlaps: boolean } {
  const viewer = uniqueRoles(viewerRoles).map(roleKey);
  const candidate = uniqueRoles(candidateRoles).map(roleKey);
  if (viewer.length === 0 || candidate.length === 0) {
    return { value: 0.5, complementary: false, overlaps: false };
  }
  const viewerSet = new Set(viewer);
  const overlaps = candidate.some((role) => viewerSet.has(role));
  const complementary = candidate.some((role) => !viewerSet.has(role));

  if (mode === 'overlap') {
    return { value: overlaps ? 1 : 0.2, complementary, overlaps };
  }
  return { value: complementary ? 1 : 0.6, complementary, overlaps };
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

  if (parts.roleFit.value === 1) {
    reasons.push(
      mode === 'overlap' ? 'Shares your roles' : "Brings roles you don't play",
    );
  } else if (mode === 'complement' && parts.roleFit.overlaps) {
    reasons.push('Plays the same roles');
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
  };
}

export function rankSuggestedUsers(
  candidates: readonly SuggestedUserCandidate[],
  viewer: SuggestedUserViewer,
  game: string,
  options: { limit?: number; mode?: SuggestedUserRoleMode } = {},
): ScoredSuggestedUser[] {
  return candidates
    .map((candidate) =>
      scoreSuggestedUser(candidate, viewer, game, options.mode),
    )
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.user.username.localeCompare(b.user.username);
    })
    .slice(0, options.limit ?? SUGGESTED_USER_LIMIT);
}

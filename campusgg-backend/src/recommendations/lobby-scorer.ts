import { findGamingProfile } from '../common/games.config';
import type { Lobby } from '../lobbies/lobby.entity';
import type { GamingProfile } from '../users/user.entity';
import {
  LOBBY_RECOMMENDATION_LIMIT,
  LOBBY_RECOMMENDATION_MIN_SCORE,
  EXPLORATION_MAX_AGE_HOURS,
  EXPLORATION_MAX_OCCUPANCY,
  LOBBY_RECOMMENDATION_WEIGHTS,
} from './recommendation.config';
import {
  ageHours,
  campusDomainFromEmail,
  campusFit,
  fitLabel,
  freshness,
  levelValue,
  occupancy,
  roundScore,
  skillFit,
  uniqueRoles,
  type FitLabel,
} from './scoring.utils';

export type LobbyCandidate = Lobby & { memberCount: number };

export interface RecommendationViewer {
  email?: string | null;
  campusDomain?: string | null;
  gamingProfiles?: GamingProfile[];
}

interface LobbyScoreParts {
  skillFit: number;
  roleFit: number;
  campusFit: number;
  occupancy: number;
  freshness: number;
}

export interface ScoredLobby {
  lobby: LobbyCandidate;
  score: number;
  fit: FitLabel;
  reasons: string[];
  exploration: boolean;
  parts: LobbyScoreParts;
}

function sameRole(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** Skill level comes from the lobby, then from the host's profile. */
export function lobbySkillLevel(lobby: LobbyCandidate): string | null {
  if (levelValue(lobby.skillLevel) !== null) return lobby.skillLevel;
  return (
    findGamingProfile(lobby.host?.gamingProfiles, lobby.game)
      ?.experienceLevel ?? null
  );
}

export function scoreLobby(
  lobby: LobbyCandidate,
  viewer: RecommendationViewer,
  now: number = Date.now(),
): ScoredLobby {
  const viewerProfile = findGamingProfile(viewer.gamingProfiles, lobby.game);
  const viewerLevel = viewerProfile?.experienceLevel ?? null;
  const viewerRoles = viewerProfile?.preferredRoles ?? [];
  const viewerDomain =
    viewer.campusDomain ?? campusDomainFromEmail(viewer.email);
  const hostDomain = campusDomainFromEmail(lobby.host?.email);
  const targetLevel = lobbySkillLevel(lobby);
  const neededRoles = uniqueRoles(lobby.neededRoles ?? []);

  const parts = {
    skillFit: skillFit(viewerLevel, targetLevel),
    roleFit: 0.5,
    campusFit: campusFit(viewerDomain, hostDomain),
    occupancy: occupancy(lobby.memberCount, lobby.participantLimit),
    freshness: freshness(lobby.updatedAt, now),
  };
  const reasons: string[] = [];

  const primaryRole = viewerRoles[0]
    ? neededRoles.find((role) => sameRole(role, viewerRoles[0]))
    : undefined;
  const secondaryRole = viewerRoles[1]
    ? neededRoles.find((role) => sameRole(role, viewerRoles[1]))
    : undefined;

  if (neededRoles.length === 0) {
    parts.roleFit = 0.5;
  } else if (primaryRole) {
    parts.roleFit = 1;
    reasons.push(`Needs ${primaryRole} — your main role`);
  } else if (secondaryRole) {
    parts.roleFit = 0.7;
    reasons.push(`Needs ${secondaryRole} — your secondary role`);
  } else {
    parts.roleFit = 0.15;
  }

  if (parts.skillFit === 1 && targetLevel) {
    reasons.push(`Same skill level: ${targetLevel}`);
  }

  // The lobby only exposes public host data, so campus affinity is derived
  // from the viewer side. Host campus is not available in P0.
  if (parts.campusFit === 1 && viewerDomain) {
    reasons.push('Same campus');
  }

  if (
    lobby.participantLimit != null &&
    parts.occupancy >= 0.8 &&
    lobby.participantLimit > 0
  ) {
    reasons.push(
      `${lobby.memberCount}/${lobby.participantLimit} — nearly full`,
    );
  }

  if (ageHours(lobby.updatedAt, now) < 24) {
    reasons.push('Active today');
  }

  const score =
    LOBBY_RECOMMENDATION_WEIGHTS.skillFit * parts.skillFit +
    LOBBY_RECOMMENDATION_WEIGHTS.roleFit * parts.roleFit +
    LOBBY_RECOMMENDATION_WEIGHTS.campusFit * parts.campusFit +
    LOBBY_RECOMMENDATION_WEIGHTS.occupancy * parts.occupancy +
    LOBBY_RECOMMENDATION_WEIGHTS.freshness * parts.freshness;

  return {
    lobby,
    score: roundScore(score),
    fit: fitLabel(score),
    reasons: reasons.slice(0, 3),
    exploration: false,
    parts,
  };
}

export function isExplorationLobby(
  lobby: LobbyCandidate,
  now: number = Date.now(),
): boolean {
  return (
    ageHours(lobby.updatedAt, now) < EXPLORATION_MAX_AGE_HOURS ||
    occupancy(lobby.memberCount, lobby.participantLimit) <
      EXPLORATION_MAX_OCCUPANCY
  );
}

function byScore(a: ScoredLobby, b: ScoredLobby): number {
  if (b.score !== a.score) return b.score - a.score;
  const updated = b.lobby.updatedAt.getTime() - a.lobby.updatedAt.getTime();
  if (updated !== 0) return updated;
  return a.lobby.id.localeCompare(b.lobby.id);
}

function withExplorationReason(reasons: string[]): string[] {
  const next = [...reasons];
  if (!next.includes('New lobby — be the first to join')) {
    next.push('New lobby — be the first to join');
  }
  return next.slice(0, 3);
}

/**
 * Rank joinable lobbies, keep one per host, and reserve the third slot for a
 * new or under-filled lobby so exploration is not crowded out by fit scores.
 */
export function rankLobbyRecommendations(
  candidates: readonly LobbyCandidate[],
  viewer: RecommendationViewer,
  options: { limit?: number; minScore?: number; now?: number } = {},
): ScoredLobby[] {
  const limit = options.limit ?? LOBBY_RECOMMENDATION_LIMIT;
  const minScore = options.minScore ?? LOBBY_RECOMMENDATION_MIN_SCORE;
  const now = options.now ?? Date.now();

  const deduped: ScoredLobby[] = [];
  const seenHosts = new Set<string>();
  for (const item of candidates
    .map((lobby) => scoreLobby(lobby, viewer, now))
    .sort(byScore)) {
    const hostId = item.lobby.host?.id ?? item.lobby.id;
    if (seenHosts.has(hostId)) continue;
    seenHosts.add(hostId);
    deduped.push(item);
  }
  if (deduped.length === 0) return [];

  const eligible = deduped.filter((item) => item.score >= minScore);
  if (eligible.length === 0) {
    const fallback = deduped[0];
    return [
      {
        ...fallback,
        exploration: true,
        reasons: withExplorationReason(fallback.reasons),
      },
    ];
  }

  if (limit < 3 || eligible.length <= limit) {
    return eligible.slice(0, limit);
  }

  const selected = eligible.slice(0, 2);
  const rest = eligible.slice(2);
  const exploration = rest.find((item) => isExplorationLobby(item.lobby, now));
  const third = exploration ?? rest[0];
  return [
    ...selected,
    {
      ...third,
      exploration: isExplorationLobby(third.lobby, now),
      reasons: isExplorationLobby(third.lobby, now)
        ? withExplorationReason(third.reasons)
        : third.reasons,
    },
  ];
}

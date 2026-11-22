import { FIT_LABELS, FRESHNESS_HALF_LIFE_HOURS } from './recommendation.config';

export type FitLabel = 'great' | 'good' | 'possible';

const EXPERIENCE_LEVELS = ['Beginner', 'Intermediate', 'Advanced'] as const;

/** Map an experience label to 0 / 1 / 2, or null when unknown. */
export function levelValue(level?: string | null): number | null {
  if (!level) return null;
  const index = EXPERIENCE_LEVELS.findIndex(
    (value) => value.toLowerCase() === level.trim().toLowerCase(),
  );
  return index === -1 ? null : index;
}

/** 1.0 for the same level, 0.5 for adjacent, 0.0 two levels apart. */
export function skillFit(
  viewerLevel?: string | null,
  targetLevel?: string | null,
): number {
  const viewer = levelValue(viewerLevel);
  const target = levelValue(targetLevel);
  if (viewer === null || target === null) return 0.5;
  return 1 - Math.abs(viewer - target) / 2;
}

/** Derive a campus domain without ever persisting or returning the email. */
export function campusDomainFromEmail(email?: string | null): string | null {
  if (typeof email !== 'string') return null;
  const at = email.lastIndexOf('@');
  if (at === -1) return null;
  const domain = email
    .slice(at + 1)
    .trim()
    .toLowerCase();
  return domain.includes('.') ? domain : null;
}

/** Same domain is strongest; different .edu schools still share context. */
export function campusFit(
  viewerDomain?: string | null,
  targetDomain?: string | null,
): number {
  if (!viewerDomain || !targetDomain) return 0.5;
  if (viewerDomain === targetDomain) return 1;
  if (viewerDomain.endsWith('.edu') && targetDomain.endsWith('.edu')) {
    return 0.35;
  }
  return 0.5;
}

/** Exponential decay; future timestamps are treated as brand new. */
export function freshness(
  updatedAt: Date,
  now: number = Date.now(),
  halfLifeHours: number = FRESHNESS_HALF_LIFE_HOURS,
): number {
  const ageHours = (now - updatedAt.getTime()) / 3_600_000;
  if (!Number.isFinite(ageHours) || ageHours <= 0) return 1;
  return Math.exp((-ageHours * Math.LN2) / halfLifeHours);
}

export function ageHours(updatedAt: Date, now: number = Date.now()): number {
  const age = (now - updatedAt.getTime()) / 3_600_000;
  return Number.isFinite(age) ? Math.max(0, age) : Number.POSITIVE_INFINITY;
}

/** Fraction filled; unlimited lobbies fall back to a five-player reference. */
export function occupancy(
  memberCount: number,
  participantLimit: number | null,
): number {
  const reference = Math.max(participantLimit ?? 5, 2);
  return Math.min(Math.max(memberCount, 0) / reference, 1);
}

export function fitLabel(score: number): FitLabel {
  if (score >= FIT_LABELS.great) return 'great';
  if (score >= FIT_LABELS.good) return 'good';
  return 'possible';
}

export function roundScore(score: number): number {
  return Math.round(score * 1000) / 1000;
}

export function uniqueRoles(roles: readonly string[]): string[] {
  const seen = new Set<string>();
  return roles.filter((role) => {
    const key = role.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Pick `limit` items from an already-sorted list. When the next item repeats a
 * campus that is already represented, an exactly-tied later item from a new
 * campus is promoted instead. This keeps ranking quality intact while avoiding
 * recommendation lists dominated by a single school.
 */
export function selectWithCampusDiversity<T>(
  sorted: readonly T[],
  limit: number,
  campusOf: (item: T) => string | null,
  isTie: (a: T, b: T) => boolean,
): T[] {
  if (limit <= 0) return [];

  const remaining = [...sorted];
  const selected: T[] = [];
  const campuses = new Set<string>();

  while (remaining.length > 0 && selected.length < limit) {
    const top = remaining[0];
    const topCampus = campusOf(top);
    let pickIndex = 0;

    if (topCampus && campuses.has(topCampus)) {
      const alternative = remaining.findIndex((candidate, index) => {
        if (index === 0) return false;
        const campus = campusOf(candidate);
        return (
          campus !== null &&
          campus !== '' &&
          !campuses.has(campus) &&
          isTie(top, candidate)
        );
      });
      if (alternative !== -1) pickIndex = alternative;
    }

    const [next] = remaining.splice(pickIndex, 1);
    selected.push(next);
    const campus = campusOf(next);
    if (campus) campuses.add(campus);
  }

  return selected;
}

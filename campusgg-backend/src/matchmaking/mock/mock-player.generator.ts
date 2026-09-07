/**
 * @file mock-player.generator.ts
 * @description Sub-issue 23.1 — Mock Data Generator
 *
 * Generates a pool of realistic mock players conforming to the
 * PlayerMatchmakingInput schema. Designed to be run standalone via ts-node:
 *
 *   npx ts-node -e "require('./src/matchmaking/mock/mock-player.generator')"
 *
 * Or imported directly by the engine in development mode:
 *
 *   import { generateMockPlayers } from './mock/mock-player.generator';
 *
 * ─── Realism Guarantees ────────────────────────────────────────────────────
 *  - Rating      : normally distributed  (mean=17500, std=3000), clamped [10k,25k]
 *  - Intensity   : beta-like distribution (bimodal — most players are casual or
 *                  try-hard, few in the middle), clamped [0, 1]
 *  - micEnabled  : Bernoulli(p=0.80)
 *  - University  : weighted toward purdue.edu (~30% share)
 *  - queueTime   : exponentially distributed (mean=90s, max cap=600s)
 *  - Roles       : weighted by realistic CS2 role demand distribution
 *
 * ─── Design Notes ──────────────────────────────────────────────────────────
 *  - Pure functions only — no side effects except the optional file write.
 *  - No external runtime dependencies (uses only Node.js built-ins).
 *  - All magic numbers are documented constants, never inline literals.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

import type {
  PlayerMatchmakingInput,
  PlayerProfile,
  CS2Stats,
  PlayerPreferences,
  CS2Role,
  ActiveSchedule,
  UniversityDomain,
} from '../schemas/player-matchmaking.schema.js';

// ─────────────────────────────────────────────────────────────────────────────
// Configuration constants — tweak here, nowhere else
// ─────────────────────────────────────────────────────────────────────────────

/** Number of mock players to generate. */
const PLAYER_COUNT = 100;

/** CS2 Premier rating distribution parameters. */
const RATING_MEAN = 17_500;
const RATING_STD  = 3_000;
const RATING_MIN  = 10_000;
const RATING_MAX  = 25_000;

/** Probability that a player has a mic (platform target: 80%). */
const MIC_ENABLED_PROBABILITY = 0.80;

/**
 * Queue time is modelled as an exponential distribution.
 * Lambda = 1 / mean, so mean wait = 90 seconds.
 * Hard-capped at 600 s to prevent unrealistic outliers.
 */
const QUEUE_TIME_MEAN_SECONDS = 90;
const QUEUE_TIME_MAX_SECONDS  = 600;

/** Path where the JSON output will be written (relative to project root). */
const OUTPUT_PATH = path.resolve(
  __dirname,
  '../../../../mock-data/mock_players.json',
);

// ─────────────────────────────────────────────────────────────────────────────
// Weighted option pools
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generic type for a pool of weighted options.
 * Weight does not need to sum to 1 — relative weights are normalised internally.
 */
interface WeightedOption<T> {
  readonly value: T;
  /** Relative weight (higher = more likely). */
  readonly weight: number;
}

/**
 * University pool — purdue.edu intentionally over-represented (~30 %).
 * Weights are proportional to estimated student gaming population.
 */
const UNIVERSITY_POOL: ReadonlyArray<WeightedOption<UniversityDomain>> = [
  { value: 'purdue.edu',       weight: 30 },
  { value: 'illinois.edu',     weight: 12 },
  { value: 'osu.edu',          weight: 11 },
  { value: 'umich.edu',        weight: 10 },
  { value: 'msu.edu',          weight: 9  },
  { value: 'indiana.edu',      weight: 8  },
  { value: 'wisc.edu',         weight: 7  },
  { value: 'psu.edu',          weight: 6  },
  { value: 'umn.edu',          weight: 5  },
  { value: 'northwestern.edu', weight: 2  },
];

/**
 * CS2 role pool — weighted by real-world role demand.
 * Entry and Support are the most common; IGL is scarce.
 */
const ROLE_POOL: ReadonlyArray<WeightedOption<CS2Role>> = [
  { value: 'Entry',   weight: 30 },
  { value: 'Support', weight: 25 },
  { value: 'AWPer',   weight: 20 },
  { value: 'Lurker',  weight: 15 },
  { value: 'IGL',     weight: 10 },
];

/**
 * Schedule pool — evening and Friday Night slots dominate the collegiate crowd.
 */
const SCHEDULE_POOL: ReadonlyArray<WeightedOption<ActiveSchedule>> = [
  { value: 'Weekday Evening',   weight: 30 },
  { value: 'Friday Night',      weight: 25 },
  { value: 'Weekend Afternoon', weight: 18 },
  { value: 'Late Night',        weight: 12 },
  { value: 'Weekday Afternoon', weight: 8  },
  { value: 'Weekend Morning',   weight: 5  },
  { value: 'Weekday Morning',   weight: 2  },
];

/** Academic majors representative of a collegiate gaming platform. */
const MAJOR_POOL: ReadonlyArray<string> = [
  'Computer Science',
  'Computer Engineering',
  'Electrical Engineering',
  'Mechanical Engineering',
  'Business Administration',
  'Finance',
  'Mathematics',
  'Data Science',
  'Information Technology',
  'Game Design',
  'Psychology',
  'Communications',
  'Liberal Arts',
  'Biology',
  'Economics',
];

// ─────────────────────────────────────────────────────────────────────────────
// Pure utility functions (no side effects, fully deterministic given RNG state)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Box-Muller transform: converts two uniform [0,1) samples into a single
 * standard-normal sample (mean=0, std=1).
 * Returns only one of the two generated values (the second is discarded here
 * for simplicity; a production RNG would cache it).
 *
 * @see https://en.wikipedia.org/wiki/Box%E2%80%93Muller_transform
 */
function sampleStandardNormal(): number {
  const u1 = Math.random();
  const u2 = Math.random();
  // Avoid log(0): u1 is nearly certain to be > 0 with float64, but guard anyway
  const safeU1 = u1 === 0 ? Number.EPSILON : u1;
  return Math.sqrt(-2 * Math.log(safeU1)) * Math.cos(2 * Math.PI * u2);
}

/**
 * Samples from a normal distribution with the given mean and standard deviation,
 * then clamps the result to [min, max].
 */
function sampleNormal(mean: number, std: number, min: number, max: number): number {
  const raw = mean + std * sampleStandardNormal();
  return Math.max(min, Math.min(max, raw));
}

/**
 * Approximates a beta-like bimodal intensity distribution by averaging two
 * uniform samples and then applying a mild non-linear push toward the extremes.
 * Result is clamped to [0, 1] and rounded to 2 decimal places.
 *
 * The formula: x = u^0.5 or x = 1 - u^0.5 with equal probability,
 * where u is uniform [0,1). This pulls mass toward 0 and 1.
 */
function sampleIntensity(): number {
  const u = Math.random();
  // Flip a coin: push toward 0 (casual) or toward 1 (competitive)
  const raw = Math.random() < 0.5 ? Math.sqrt(u) * 0.5 : 1 - Math.sqrt(u) * 0.5;
  return Math.round(Math.max(0, Math.min(1, raw)) * 100) / 100;
}

/**
 * Samples from an exponential distribution with the given mean,
 * capped at maxValue.
 *
 * Uses the inverse CDF method: X = -mean * ln(U), U ~ Uniform(0,1).
 */
function sampleExponential(mean: number, maxValue: number): number {
  const u = Math.random();
  const safeU = u === 0 ? Number.EPSILON : u;
  return Math.min(maxValue, Math.round(-mean * Math.log(safeU)));
}

/**
 * Selects a random item from a weighted pool.
 * Time complexity: O(n) — acceptable for small pools.
 *
 * @param pool - Array of { value, weight } objects.
 * @returns The selected value.
 */
function sampleWeighted<T>(pool: ReadonlyArray<WeightedOption<T>>): T {
  const totalWeight = pool.reduce((sum, item) => sum + item.weight, 0);
  let cursor = Math.random() * totalWeight;
  for (const item of pool) {
    cursor -= item.weight;
    if (cursor <= 0) return item.value;
  }
  // Fallback to last item (handles floating-point edge cases)
  return pool[pool.length - 1].value;
}

/**
 * Picks a uniformly random element from a plain array.
 */
function sampleUniform<T>(arr: ReadonlyArray<T>): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Returns true with probability `p`.
 */
function bernoulli(p: number): boolean {
  return Math.random() < p;
}

/**
 * Generates a namespaced UUID v4 identifier.
 * Format: `usr_<hex-string>`
 */
function generateUserId(): string {
  return `usr_${crypto.randomUUID()}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-generators — one pure function per schema interface
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generates a realistic PlayerProfile using the weighted university pool,
 * a uniform major pool, and the weighted schedule pool.
 */
function generateProfile(): PlayerProfile {
  return {
    universityDomain : sampleWeighted(UNIVERSITY_POOL),
    major            : sampleUniform(MAJOR_POOL),
    activeSchedule   : sampleWeighted(SCHEDULE_POOL),
  };
}

/**
 * Generates CS2Stats with a normally-distributed Premier rating.
 * The mean (17,500) approximates the top-25% of active Premier players —
 * collegiate gamers skew slightly above the global average.
 */
function generateCS2Stats(): CS2Stats {
  return {
    game   : 'CS2',
    rating : Math.round(sampleNormal(RATING_MEAN, RATING_STD, RATING_MIN, RATING_MAX)),
  };
}

/**
 * Generates PlayerPreferences, ensuring primaryRole !== secondaryRole.
 */
function generatePreferences(): PlayerPreferences {
  const primary = sampleWeighted(ROLE_POOL);

  // Re-sample until we get a distinct secondary role
  let secondary: CS2Role;
  do {
    secondary = sampleWeighted(ROLE_POOL);
  } while (secondary === primary);

  return {
    primaryRole   : primary,
    secondaryRole : secondary,
    micEnabled    : bernoulli(MIC_ENABLED_PROBABILITY),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Root generator — assembles all sub-generators into a single player
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generates a single mock player conforming to PlayerMatchmakingInput.
 * All fields are independently sampled from their respective distributions.
 */
function generateMockPlayer(): PlayerMatchmakingInput {
  return {
    userId      : generateUserId(),
    game        : 'CS2',
    profile     : generateProfile(),
    stats       : generateCS2Stats(),
    preferences : generatePreferences(),
    intensity   : sampleIntensity(),
    queueTime   : sampleExponential(QUEUE_TIME_MEAN_SECONDS, QUEUE_TIME_MAX_SECONDS),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API — importable by the matchmaking engine in dev mode
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generates an array of `count` mock players.
 *
 * @param count - Number of players to generate (defaults to PLAYER_COUNT).
 * @returns     - Readonly array of PlayerMatchmakingInput objects.
 *
 * @example
 * import { generateMockPlayers } from './mock/mock-player.generator';
 * const pool = generateMockPlayers(50); // generate 50 players
 */
export function generateMockPlayers(count: number = PLAYER_COUNT): ReadonlyArray<PlayerMatchmakingInput> {
  return Array.from({ length: count }, generateMockPlayer);
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI entry point — write JSON to disk when run directly via ts-node
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Writes the mock player pool to OUTPUT_PATH as formatted JSON.
 * Only runs when this module is executed directly (not when imported).
 */
function writeMockDataToFile(): void {
  const players = generateMockPlayers(PLAYER_COUNT);

  // Ensure the output directory exists
  const outputDir = path.dirname(OUTPUT_PATH);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const json = JSON.stringify(players, null, 2);
  fs.writeFileSync(OUTPUT_PATH, json, 'utf-8');

  // ── Summary statistics (useful for visual sanity check) ───────────────────
  const ratings    = players.map((p) => (p.stats as CS2Stats).rating);
  const avgRating  = ratings.reduce((a, b) => a + b, 0) / ratings.length;
  const micCount   = players.filter((p) => p.preferences.micEnabled).length;
  const purdueCount = players.filter((p) => p.profile.universityDomain === 'purdue.edu').length;
  const avgIntensity = players.reduce((a, b) => a + b.intensity, 0) / players.length;

  console.log('');
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║  CampusGG — Mock Player Pool Generated           ║');
  console.log('╠══════════════════════════════════════════════════╣');
  console.log(`║  Players generated : ${String(players.length).padEnd(27)}║`);
  console.log(`║  Avg CS2 Rating    : ${String(Math.round(avgRating)).padEnd(27)}║`);
  console.log(`║  Mic Enabled       : ${String(micCount).padEnd(27)}║`);
  console.log(`║  Purdue players    : ${String(purdueCount).padEnd(27)}║`);
  console.log(`║  Avg Intensity     : ${String(avgIntensity.toFixed(2)).padEnd(27)}║`);
  console.log(`║  Output            : ${String('mock-data/mock_players.json').padEnd(27)}║`);
  console.log('╚══════════════════════════════════════════════════╝');
  console.log('');
}

// Detect direct invocation: both ts-node and compiled JS set require.main
if (require.main === module) {
  writeMockDataToFile();
}

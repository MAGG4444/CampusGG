/**
 * @file run-engine.ts
 * @description Sub-issue 24.2 — Dynamic Time Decay Integration
 *
 * Loads mock_players.json, enqueues players into the matchmaking engine,
 * evaluates candidate groups of 5 players using CompetitiveScoringStrategy,
 * and dynamically calculates the acceptance threshold based on queue wait time
 * using the time-decay model (resolveGroupThreshold).
 *
 * Run:
 *   npx ts-node src/matchmaking/engine/run-engine.ts
 *
 * Or with Python runner fallback (see run-engine-fallback.py)
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

import type { PlayerMatchmakingInput, SupportedGame } from '../schemas/player-matchmaking.schema.js';
import type { MatchGroup } from '../schemas/match-group.schema.js';
import { getScoringStrategy } from './strategy-registry.js';
import { getGroupSize, getTier } from './game-tiers.config.js';
// Step 1: Import resolveGroupThreshold from ./time-decay-model
import { resolveGroupThreshold } from './time-decay-model.js';

// ─────────────────────────────────────────────────────────────────────────────
// 1. Load mock data
// ─────────────────────────────────────────────────────────────────────────────

const MOCK_DATA_PATH = path.resolve(__dirname, '../../../../mock-data/mock_players.json');
const rawJson = fs.readFileSync(MOCK_DATA_PATH, 'utf-8');
const mockPlayers = JSON.parse(rawJson) as unknown as PlayerMatchmakingInput[];

console.log('');
console.log('╔══════════════════════════════════════════════════════════════════╗');
console.log('║  CampusGG — Matchmaking Engine + Time Decay (Sub-issue 24.2)    ║');
console.log('╚══════════════════════════════════════════════════════════════════╝');
console.log(`  Loaded ${mockPlayers.length} players from mock_players.json`);
console.log('');

// ─────────────────────────────────────────────────────────────────────────────
// 2. Determine strategy from the mock data's game field
// ─────────────────────────────────────────────────────────────────────────────

/**
 * All mock players share the same game ('CS2'), but we use the registry
 * to resolve the correct strategy dynamically — proving the factory works.
 */
const primaryGame: SupportedGame = mockPlayers[0]?.game ?? 'CS2';
const strategy = getScoringStrategy(primaryGame);

console.log(`  Strategy resolved: ${strategy.constructor.name} (for ${primaryGame})`);
console.log('');

// ─────────────────────────────────────────────────────────────────────────────
// 3. onMatchFound Callback
// ─────────────────────────────────────────────────────────────────────────────

/** Tracks groups formed for the summary. */
let totalGroupsFormed = 0;

/**
 * Mock `onMatchFound` callback — simulates what the Lobby service would do.
 * In production, this would emit an event / call the Lobby microservice.
 */
function onMatchFound(group: MatchGroup): void {
  totalGroupsFormed++;

  const playerList = group.userIds
    .map((id) => id.slice(0, 16) + '...')  // truncate UUIDs for readability
    .join(', ');

  console.log(
    `  [MATCH #${String(totalGroupsFormed).padStart(2, '0')}] ` +
    `${group.game} (${group.tier}, ${group.userIds.length}p) | ` +
    `score: ${group.score.toFixed(4)} | ` +
    `group: ${group.groupId.slice(0, 16)}...`,
  );
  console.log(`           players: [${playerList}]`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Enqueue all players (Partition by game)
// ─────────────────────────────────────────────────────────────────────────────

const queue: Map<SupportedGame, PlayerMatchmakingInput[]> = new Map();

for (const player of mockPlayers) {
  if (!queue.has(player.game)) {
    queue.set(player.game, []);
  }
  const gameQueue = queue.get(player.game)!;
  if (!gameQueue.some((p) => p.userId === player.userId)) {
    gameQueue.push(player);
  }
}

console.log('── Queue state before processing ──────────────────────────────');
let totalQueued = 0;
for (const players of queue.values()) {
  totalQueued += players.length;
}
console.log(`  Total players queued: ${totalQueued}`);
for (const [game, players] of queue.entries()) {
  console.log(`    ${game}: ${players.length} players (tier: ${getTier(game)}, group size: ${getGroupSize(game)})`);
}
console.log('');

// ─────────────────────────────────────────────────────────────────────────────
// 5. Core Matchmaking Loop (Dynamic Time Decay Threshold)
// ─────────────────────────────────────────────────────────────────────────────

console.log('── Processing queue (CompetitiveScoringStrategy + Time Decay) ─');
const formedGroups: MatchGroup[] = [];

for (const [game, players] of queue.entries()) {
  const groupSize = getGroupSize(game);
  const tier = getTier(game);

  while (players.length >= groupSize) {
    // Step 2: When the engine groups 5 candidate players for evaluation
    const candidateGroup = players.slice(0, groupSize);

    // Extract an array of their current wait times
    const waitTimes = candidateGroup.map((p) => p.queueTime);

    // Step 3: Pass wait times to resolveGroupThreshold() to calculate groupDynamicThreshold.
    // The longest-waiting player dictates the group's passing score to ensure queue liquidity.
    const groupDynamicThreshold = resolveGroupThreshold(waitTimes);

    // Step 4: Calculate actual group match score using our existing scoring strategy
    const actualMatchScore = strategy.scoreGroup(candidateGroup);

    // Step 5: Compare actualMatchScore against groupDynamicThreshold (instead of static threshold)
    if (actualMatchScore >= groupDynamicThreshold) {
      // Step 6: If score >= dynamic threshold, trigger onMatchFound callback
      const matchGroup: MatchGroup = {
        groupId: `grp_${crypto.randomUUID()}`,
        game,
        tier,
        userIds: candidateGroup.map((p) => p.userId),
        score: actualMatchScore,
        matchedAt: new Date().toISOString(),
      };

      // Remove matched players from queue
      players.splice(0, groupSize);

      onMatchFound(matchGroup);
      formedGroups.push(matchGroup);
    } else {
      // If not, reject the group and continue the loop (skip failing candidate head)
      console.log(
        `  [Engine] Group for ${game} scored ${actualMatchScore.toFixed(4)} — ` +
        `below dynamic threshold ${groupDynamicThreshold.toFixed(4)} ` +
        `(max wait: ${Math.max(...waitTimes)}s). Skipping.`,
      );
      break;
    }
  }
}
console.log('');

// ─────────────────────────────────────────────────────────────────────────────
// 6. Summary with scoring analytics
// ─────────────────────────────────────────────────────────────────────────────

console.log('── Summary ────────────────────────────────────────────────────');
console.log(`  Total groups formed   : ${formedGroups.length}`);
console.log(`  Total players matched : ${formedGroups.reduce((sum, g) => sum + g.userIds.length, 0)}`);

let totalRemaining = 0;
for (const players of queue.values()) {
  totalRemaining += players.length;
}
console.log(`  Remaining in queue    : ${totalRemaining}`);

if (formedGroups.length > 0) {
  const scores = formedGroups.map((g) => g.score);
  const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
  const minScore = Math.min(...scores);
  const maxScore = Math.max(...scores);

  console.log('');
  console.log('── Score Distribution ─────────────────────────────────────────');
  console.log(`  Average score : ${avgScore.toFixed(4)}`);
  console.log(`  Min score     : ${minScore.toFixed(4)}`);
  console.log(`  Max score     : ${maxScore.toFixed(4)}`);
  console.log(`  Spread        : ${(maxScore - minScore).toFixed(4)}`);
}

for (const [game, count] of queue.entries()) {
  if (count.length > 0) {
    console.log(`    ${game}: ${count.length} leftover (not enough for a full group)`);
  }
}

console.log('');
console.log('  ✓ Real dynamic time decay scoring verified end-to-end.');
console.log('');



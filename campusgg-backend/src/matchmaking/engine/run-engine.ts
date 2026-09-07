/**
 * @file run-engine.ts
 * @description Sub-issue 23.2 — Engine Execution & Smoke Test Script
 *
 * Loads mock_players.json, enqueues every player into the MatchmakingEngine
 * with a DummyStrategy, processes the queue, and logs every MatchGroup that
 * is handed off — proving the end-to-end loop works.
 *
 * Run:
 *   npx ts-node src/matchmaking/engine/run-engine.ts
 *
 * Or with Python runner fallback (see run-engine-fallback.py)
 */

import * as fs from 'fs';
import * as path from 'path';

import type { PlayerMatchmakingInput } from '../schemas/player-matchmaking.schema.js';
import type { MatchGroup } from '../schemas/match-group.schema.js';
import { DummyStrategy } from './match-strategy.interface.js';
import { MatchmakingEngine } from './matchmaking-engine.js';
import { getGroupSize, getTier } from './game-tiers.config.js';

// ─────────────────────────────────────────────────────────────────────────────
// 1. Load mock data
// ─────────────────────────────────────────────────────────────────────────────

const MOCK_DATA_PATH = path.resolve(__dirname, '../../../../mock-data/mock_players.json');
const rawJson = fs.readFileSync(MOCK_DATA_PATH, 'utf-8');
const mockPlayers: PlayerMatchmakingInput[] = JSON.parse(rawJson);

console.log('');
console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║  CampusGG — Matchmaking Engine Smoke Test (Sub-issue 23.2)  ║');
console.log('╚══════════════════════════════════════════════════════════════╝');
console.log(`  Loaded ${mockPlayers.length} players from mock_players.json`);
console.log('');

// ─────────────────────────────────────────────────────────────────────────────
// 2. Configure the engine
// ─────────────────────────────────────────────────────────────────────────────

/** Tracks total groups formed for the summary. */
let totalGroupsFormed = 0;

/**
 * Mock `onMatchFound` callback — simulates what the Lobby service would do.
 * In production, this would emit an event / call the Lobby microservice.
 */
function handleMatchFound(group: MatchGroup): void {
  totalGroupsFormed++;

  const playerList = group.userIds
    .map((id) => id.slice(0, 16) + '...')  // truncate UUIDs for readability
    .join(', ');

  console.log(
    `  [MATCH #${String(totalGroupsFormed).padStart(2, '0')}] ` +
    `${group.game} (${group.tier}, ${group.userIds.length}p) | ` +
    `score: ${group.score.toFixed(2)} | ` +
    `group: ${group.groupId.slice(0, 16)}...`,
  );
  console.log(`           players: [${playerList}]`);
}

const engine = new MatchmakingEngine({
  strategy: new DummyStrategy(),
  onMatchFound: handleMatchFound,
  scoreThreshold: 0.70,
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Enqueue all players
// ─────────────────────────────────────────────────────────────────────────────

for (const player of mockPlayers) {
  engine.enqueue(player);
}

console.log('── Queue state before processing ──────────────────────────────');
console.log(`  Total players queued: ${engine.getTotalQueueSize()}`);
const preSnapshot = engine.getQueueSnapshot();
for (const [game, count] of Object.entries(preSnapshot)) {
  console.log(`    ${game}: ${count} players (tier: ${getTier(game as any)}, group size: ${getGroupSize(game as any)})`);
}
console.log('');

// ─────────────────────────────────────────────────────────────────────────────
// 4. Process the queue
// ─────────────────────────────────────────────────────────────────────────────

console.log('── Processing queue ───────────────────────────────────────────');
const formedGroups = engine.processQueue();
console.log('');

// ─────────────────────────────────────────────────────────────────────────────
// 5. Summary
// ─────────────────────────────────────────────────────────────────────────────

console.log('── Summary ────────────────────────────────────────────────────');
console.log(`  Total groups formed : ${formedGroups.length}`);
console.log(`  Total players matched : ${formedGroups.reduce((sum, g) => sum + g.userIds.length, 0)}`);
console.log(`  Remaining in queue  : ${engine.getTotalQueueSize()}`);

const postSnapshot = engine.getQueueSnapshot();
for (const [game, count] of Object.entries(postSnapshot)) {
  if (count > 0) {
    console.log(`    ${game}: ${count} leftover (not enough for a full group)`);
  }
}

console.log('');
console.log('  Engine loop verified. Ready for Sub-issue 23.3 (real scoring).');
console.log('');

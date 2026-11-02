/**
 * @file run-engine.ts
 * @description Sub-issue 24.2 — Dynamic Time Decay Integration
 *
 * Loads mock_players.json, enqueues players with simulated wait times, and
 * runs the real MatchmakingEngine (including its best-of-window search and
 * dynamic threshold) end-to-end.
 *
 * Run:
 *   npm run build && node dist/matchmaking/engine/run-engine.js
 */

import * as fs from 'fs';
import * as path from 'path';

import type {
  PlayerMatchmakingInput,
  SupportedGame,
} from '../schemas/player-matchmaking.schema.js';
import type { MatchGroup } from '../schemas/match-group.schema.js';
import { MatchmakingEngine } from './matchmaking-engine.js';
import { getScoringStrategy } from './strategy-registry.js';
import { getGroupSize, getTier } from './game-tiers.config.js';

// ─────────────────────────────────────────────────────────────────────────────
// Mock data
// ─────────────────────────────────────────────────────────────────────────────

/** The JSON fixtures include a simulated queueTime for each player. */
type MockPlayer = PlayerMatchmakingInput & { queueTime?: number };

const MOCK_DATA_PATH = path.resolve(
  __dirname,
  '../../../../mock-data/mock_players.json',
);

const mockPlayers = JSON.parse(
  fs.readFileSync(MOCK_DATA_PATH, 'utf-8'),
) as MockPlayer[];

// ─────────────────────────────────────────────────────────────────────────────
// Runner
// ─────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('');
  console.log(
    '╔══════════════════════════════════════════════════════════════════╗',
  );
  console.log(
    '║  CampusGG — Matchmaking Engine + Time Decay (Sub-issue 24.2)    ║',
  );
  console.log(
    '╚══════════════════════════════════════════════════════════════════╝',
  );
  console.log(`  Loaded ${mockPlayers.length} players from mock_players.json`);
  console.log('');

  let totalGroupsFormed = 0;

  const engine = new MatchmakingEngine({
    strategyResolver: getScoringStrategy,
    onMatchFound: (group: MatchGroup) => {
      totalGroupsFormed++;

      const playerList = group.userIds
        .map((id) => id.slice(0, 16) + '...')
        .join(', ');

      console.log(
        `  [MATCH #${String(totalGroupsFormed).padStart(2, '0')}] ` +
          `${group.game} (${group.tier}, ${group.userIds.length}p) | ` +
          `score: ${group.score.toFixed(4)} | ` +
          `group: ${group.groupId.slice(0, 16)}...`,
      );
      console.log(`            players: [${playerList}]`);
    },
  });

  // Simulate each player's wait time by back-dating their enqueue timestamp.
  const now = Date.now();
  for (const player of mockPlayers) {
    const { queueTime = 0, ...input } = player;
    engine.enqueue(input, now - queueTime * 1000);
  }

  console.log(
    '── Queue state before processing ──────────────────────────────',
  );
  console.log(`  Total players queued: ${engine.getTotalQueueSize()}`);
  const snapshot = engine.getQueueSnapshot();
  for (const [game, count] of Object.entries(snapshot) as [
    SupportedGame,
    number,
  ][]) {
    console.log(
      `    ${game}: ${count} players (tier: ${getTier(game)}, group size: ${getGroupSize(game)})`,
    );
  }
  console.log('');

  console.log(
    '── Processing queue (best-of-window + time decay) ─────────────',
  );
  const formedGroups = await engine.processQueue(now);
  console.log('');

  // ── Summary ────────────────────────────────────────────────────────────
  console.log(
    '── Summary ────────────────────────────────────────────────────',
  );
  console.log(`  Total groups formed   : ${formedGroups.length}`);
  console.log(
    `  Total players matched : ${formedGroups.reduce(
      (sum, group) => sum + group.userIds.length,
      0,
    )}`,
  );
  console.log(`  Remaining in queue    : ${engine.getTotalQueueSize()}`);

  if (formedGroups.length > 0) {
    const scores = formedGroups.map((group) => group.score);
    const averageScore =
      scores.reduce((sum, score) => sum + score, 0) / scores.length;

    console.log('');
    console.log(
      '── Score Distribution ─────────────────────────────────────────',
    );
    console.log(`  Average score : ${averageScore.toFixed(4)}`);
    console.log(`  Min score     : ${Math.min(...scores).toFixed(4)}`);
    console.log(`  Max score     : ${Math.max(...scores).toFixed(4)}`);
    console.log(
      `  Spread        : ${(Math.max(...scores) - Math.min(...scores)).toFixed(4)}`,
    );
  }

  for (const [game, count] of Object.entries(engine.getQueueSnapshot()) as [
    SupportedGame,
    number,
  ][]) {
    if (count === 0) {
      continue;
    }

    const reason =
      count < getGroupSize(game)
        ? 'not enough for a full group'
        : 'no acceptable group at current wait times';

    console.log(`    ${game}: ${count} leftover (${reason})`);
  }

  console.log('');
  console.log('  ✓ Engine + time decay run complete.');
  console.log('');
}

void main();

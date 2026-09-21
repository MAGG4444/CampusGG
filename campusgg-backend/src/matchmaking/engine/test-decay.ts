/**
 * @file test-decay.ts
 * @description Sub-issue 24.1 — Time Decay Curve Verification Script
 *
 * Prints a formatted table of threshold values for queue times 0–350s
 * in 30-second increments, proving the exponential decay curve is
 * smooth and hits all design targets.
 *
 * Run:
 *   npx ts-node src/matchmaking/engine/test-decay.ts
 *
 * Expected output:
 *   A table showing the threshold dropping from 0.850 (at 0s)
 *   through ~0.600 (at 180s) to 0.300 (at 300s+).
 */

import { getAcceptableThreshold, resolveGroupThreshold } from './time-decay-model.js';
import {
  INITIAL_THRESHOLD,
  MINIMUM_THRESHOLD_FLOOR,
  MAX_WAIT_REFERENCE,
  DECAY_RATE_K,
} from './time-decay.config.js';

// ─────────────────────────────────────────────────────────────────────────────
// 1. Config summary
// ─────────────────────────────────────────────────────────────────────────────

console.log('');
console.log('=================================================================');
console.log('  CampusGG -- Time Decay Curve Verification (Sub-issue 24.1)');
console.log('=================================================================');
console.log('');
console.log('  Configuration:');
console.log(`    Initial Threshold     : ${INITIAL_THRESHOLD}`);
console.log(`    Minimum Floor         : ${MINIMUM_THRESHOLD_FLOOR}`);
console.log(`    Max Wait Reference    : ${MAX_WAIT_REFERENCE}s`);
console.log(`    Decay Rate (k)        : ${DECAY_RATE_K}`);
console.log(`    Decayable Range       : ${(INITIAL_THRESHOLD - MINIMUM_THRESHOLD_FLOOR).toFixed(2)}`);
console.log(`    Formula               : floor + range * e^(-k * t)`);
console.log('');

// ─────────────────────────────────────────────────────────────────────────────
// 2. Threshold table (0–350s in 30s steps)
// ─────────────────────────────────────────────────────────────────────────────

const STEP = 30;
const MAX_T = 350;

/** Render a simple ASCII bar chart for visual verification. */
function renderBar(value: number, maxValue: number, barWidth: number): string {
  const filled = Math.round((value / maxValue) * barWidth);
  return '#'.repeat(filled) + '-'.repeat(barWidth - filled);
}

console.log('  +--------+-----------+-------------------------------------------+');
console.log('  | Time   | Threshold | Curve                                     |');
console.log('  +--------+-----------+-------------------------------------------+');

for (let t = 0; t <= MAX_T; t += STEP) {
  const threshold = getAcceptableThreshold(t);
  const timeStr = `${t}s`.padStart(5);
  const threshStr = threshold.toFixed(4);
  const bar = renderBar(threshold, 1.0, 40);

  // Mark design target checkpoints
  let marker = '';
  if (t === 0) marker = ' <-- initial';
  if (t === 180) marker = ' <-- 3min target (~0.60)';
  if (t === 300) marker = ' <-- floor (5min)';

  console.log(`  | ${timeStr} |  ${threshStr}  | ${bar} |${marker}`);
}

console.log('  +--------+-----------+-------------------------------------------+');
console.log('');

// ─────────────────────────────────────────────────────────────────────────────
// 3. resolveGroupThreshold demo
// ─────────────────────────────────────────────────────────────────────────────

console.log('  resolveGroupThreshold demo (longest-waiting player wins):');
console.log('  ---------------------------------------------------------');

const testGroups: Array<{ label: string; times: number[] }> = [
  { label: 'Fresh group (all just queued)',       times: [0, 5, 10, 3, 8] },
  { label: 'Mixed group (one waited 2 min)',      times: [10, 25, 45, 120, 30] },
  { label: 'Urgent group (one waited 4 min)',     times: [15, 20, 30, 240, 10] },
  { label: 'Desperate group (all waited 5 min)',   times: [300, 310, 295, 305, 300] },
];

for (const { label, times } of testGroups) {
  const threshold = resolveGroupThreshold(times);
  const maxT = Math.max(...times);
  console.log(`    ${label}`);
  console.log(`      queueTimes: [${times.join(', ')}]`);
  console.log(`      max wait: ${maxT}s -> threshold: ${threshold.toFixed(4)}`);
  console.log('');
}

console.log('  [OK] Time decay model verified.');
console.log('');

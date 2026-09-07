#!/usr/bin/env python3
"""
run-engine-fallback.py  --  Sub-issue 23.2 Smoke Test (Python fallback)

Mirrors the TypeScript run-engine.ts logic using pure Python to validate
the engine design when Node.js is not available on the local machine.

This script:
  1. Loads mock_players.json
  2. Partitions players by game
  3. Looks up group sizes from tier config
  4. Applies DummyStrategy (always 0.85)
  5. Forms groups and emits MatchGroup payloads

Run:
    py src/matchmaking/engine/run-engine-fallback.py
"""

import json
import uuid
from datetime import datetime, timezone
from pathlib import Path

# ── Configuration ────────────────────────────────────────────────────────────

MOCK_DATA_PATH = Path(__file__).parents[4] / "mock-data" / "mock_players.json"
SCORE_THRESHOLD = 0.70
DUMMY_SCORE = 0.85

# ── Tier config (mirrors game-tiers.config.ts) ───────────────────────────────

GAME_TIER_MAP: dict[str, str] = {
    "CS2":               "Competitive",
    "Valorant":          "Competitive",
    "League of Legends": "Competitive",
    "Dota":              "Competitive",
    "OW2":               "Competitive",
    "Rocket League":     "Competitive",
    "It Takes Two":      "Casual",
}

TIER_GROUP_SIZE: dict[str, int] = {
    "Competitive": 5,
    "Casual":      2,
}

def get_group_size(game: str) -> int:
    tier = GAME_TIER_MAP.get(game)
    if tier is None:
        raise ValueError(f"Unknown game: {game}")
    return TIER_GROUP_SIZE[tier]

def get_tier(game: str) -> str:
    tier = GAME_TIER_MAP.get(game)
    if tier is None:
        raise ValueError(f"Unknown game: {game}")
    return tier

# ── Load mock data ───────────────────────────────────────────────────────────

raw = MOCK_DATA_PATH.read_text(encoding="utf-8")
players: list[dict] = json.loads(raw)

print()
print("\u2554" + "\u2550" * 62 + "\u2557")
print("\u2551  CampusGG \u2014 Matchmaking Engine Smoke Test (Sub-issue 23.2)  \u2551")
print("\u255a" + "\u2550" * 62 + "\u255d")
print(f"  Loaded {len(players)} players from mock_players.json")
print()

# ── Partition by game (hard partitioning) ────────────────────────────────────

queue: dict[str, list[dict]] = {}
for p in players:
    game = p["game"]
    if game not in queue:
        queue[game] = []
    queue[game].append(p)

print("\u2500\u2500 Queue state before processing " + "\u2500" * 30)
total_queued = sum(len(v) for v in queue.values())
print(f"  Total players queued: {total_queued}")
for game, q in queue.items():
    print(f"    {game}: {len(q)} players (tier: {get_tier(game)}, group size: {get_group_size(game)})")
print()

# ── Process queue ────────────────────────────────────────────────────────────

print("\u2500\u2500 Processing queue " + "\u2500" * 43)

formed_groups: list[dict] = []
group_counter = 0

for game, game_queue in queue.items():
    group_size = get_group_size(game)
    tier = get_tier(game)

    while len(game_queue) >= group_size:
        candidates = game_queue[:group_size]
        score = DUMMY_SCORE  # DummyStrategy

        if score >= SCORE_THRESHOLD:
            group_counter += 1
            group_id = f"grp_{uuid.uuid4()}"
            user_ids = [c["userId"] for c in candidates]
            match_group = {
                "groupId":   group_id,
                "game":      game,
                "tier":      tier,
                "userIds":   user_ids,
                "score":     score,
                "matchedAt": datetime.now(timezone.utc).isoformat(),
            }

            # Remove matched players
            del game_queue[:group_size]

            # Handoff callback (console.log mock)
            truncated = [uid[:16] + "..." for uid in user_ids]
            print(
                f"  [MATCH #{group_counter:02d}] "
                f"{game} ({tier}, {len(user_ids)}p) | "
                f"score: {score:.2f} | "
                f"group: {group_id[:16]}..."
            )
            print(f"           players: [{', '.join(truncated)}]")

            formed_groups.append(match_group)
        else:
            print(
                f"  [Engine] Group for {game} scored {score:.2f} \u2014 "
                f"below threshold {SCORE_THRESHOLD:.2f}. Skipping."
            )
            break

print()

# ── Summary ──────────────────────────────────────────────────────────────────

total_matched = sum(len(g["userIds"]) for g in formed_groups)
remaining = sum(len(v) for v in queue.values())

print("\u2500\u2500 Summary " + "\u2500" * 52)
print(f"  Total groups formed   : {len(formed_groups)}")
print(f"  Total players matched : {total_matched}")
print(f"  Remaining in queue    : {remaining}")

for game, q in queue.items():
    if len(q) > 0:
        print(f"    {game}: {len(q)} leftover (not enough for a full group)")

print()
print("  Engine loop verified. Ready for Sub-issue 23.3 (real scoring).")
print()

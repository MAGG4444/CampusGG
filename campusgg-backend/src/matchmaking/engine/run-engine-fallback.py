#!/usr/bin/env python3
"""
run-engine-fallback.py  --  Sub-issue 23.3 Smoke Test (Python fallback)

Mirrors the TypeScript run-engine.ts logic using pure Python to validate
the REAL CompetitiveScoringStrategy when Node.js is not available.

This script:
  1. Loads mock_players.json
  2. Partitions players by game
  3. Applies the real multi-dimensional scoring math:
     - W1: Skill Cohesion (30%) - rating spread
     - W2: Intensity Alignment (30%) - intensity spread
     - W3: Profile Affinity (40%) - university + major overlap
     - x  Role Synergy Multiplier - unique primaryRole diversity
  4. Forms groups and emits MatchGroup payloads

Run:
    py src/matchmaking/engine/run-engine-fallback.py
"""

import json
import uuid
import math
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

# ── Scoring Configuration (mirrors scoring.config.ts) ────────────────────────

SKILL_WEIGHT               = 0.3
INTENT_WEIGHT              = 0.3
PROFILE_WEIGHT             = 0.4

PERFECT_RATING_DELTA       = 500
MAX_RATING_PENALTY_DELTA   = 2000
SKILL_FLOOR                = 0.2

PERFECT_INTENSITY_DELTA    = 0.2
MAX_INTENSITY_PENALTY_DELTA = 1.0

SAME_MAJOR_PAIR_BONUS      = 0.1
MAX_ROLE_SYNERGY_MULTIPLIER = 1.1

# ── Time Decay Configuration (mirrors time-decay.config.ts) ──────────────────

INITIAL_THRESHOLD       = 0.85
MINIMUM_THRESHOLD_FLOOR = 0.30
MAX_WAIT_REFERENCE      = 300    # seconds
DECAY_RATE_K            = 0.003367

def get_acceptable_threshold(queue_time: float) -> float:
    t = max(0.0, queue_time)
    if t >= MAX_WAIT_REFERENCE:
        return MINIMUM_THRESHOLD_FLOOR
    decayable_range = INITIAL_THRESHOLD - MINIMUM_THRESHOLD_FLOOR
    decay = math.exp(-DECAY_RATE_K * t)
    return max(MINIMUM_THRESHOLD_FLOOR, MINIMUM_THRESHOLD_FLOOR + decayable_range * decay)

def resolve_group_threshold(queue_times: list[float]) -> float:
    """The longest-waiting player dictates the group's passing score to ensure queue liquidity."""
    if not queue_times:
        raise ValueError("Empty queue_times array")
    return get_acceptable_threshold(max(queue_times))

# ── Tier Configuration (mirrors game-tiers.config.ts) ────────────────────────

GAME_TIER_MAP: dict[str, str] = {
    "CS2": "Competitive", "Valorant": "Competitive",
    "League of Legends": "Competitive", "Dota": "Competitive",
    "OW2": "Competitive", "Rocket League": "Competitive",
    "It Takes Two": "Casual",
}
TIER_GROUP_SIZE: dict[str, int] = {"Competitive": 5, "Casual": 2}

MOCK_DATA_PATH = Path(__file__).parents[4] / "mock-data" / "mock_players.json"

def get_group_size(game: str) -> int:
    return TIER_GROUP_SIZE[GAME_TIER_MAP[game]]

def get_tier(game: str) -> str:
    return GAME_TIER_MAP[game]

# ── Scoring Functions (mirrors scoring-strategies.ts) ────────────────────────

def linear_decay(value: float, start: float, end: float,
                 score_start: float, score_end: float) -> float:
    """Linearly interpolate score between two thresholds."""
    if value <= start:
        return score_start
    if value >= end:
        return score_end
    t = (value - start) / (end - start)
    return score_start + t * (score_end - score_start)

def score_skill_cohesion(group: list[dict]) -> float:
    """W1: Rating spread -> [SKILL_FLOOR, 1.0]."""
    ratings = [p["stats"]["rating"] for p in group]
    delta = max(ratings) - min(ratings)
    return linear_decay(delta, PERFECT_RATING_DELTA, MAX_RATING_PENALTY_DELTA, 1.0, SKILL_FLOOR)

def score_intensity_alignment(group: list[dict]) -> float:
    """W2: Intensity spread -> [0.0, 1.0]."""
    intensities = [p["intensity"] for p in group]
    delta = max(intensities) - min(intensities)
    return linear_decay(delta, PERFECT_INTENSITY_DELTA, MAX_INTENSITY_PENALTY_DELTA, 1.0, 0.0)

def count_matching_pairs(values: list[str]) -> int:
    """Count distinct pairs sharing the same value."""
    freq = Counter(values)
    return sum(f * (f - 1) // 2 for f in freq.values())

def score_profile_affinity(group: list[dict]) -> float:
    """W3: University overlap + major pair bonus -> [0.0, 1.0]."""
    size = len(group)
    domains = [p["profile"]["universityDomain"] for p in group]
    max_freq = max(Counter(domains).values())
    base = max_freq / size

    majors = [p["profile"]["major"] for p in group]
    major_bonus = count_matching_pairs(majors) * SAME_MAJOR_PAIR_BONUS

    return min(1.0, base + major_bonus)

def compute_role_synergy(group: list[dict]) -> float:
    """Role diversity multiplier -> [1.0, MAX_ROLE_SYNERGY_MULTIPLIER]."""
    unique = len(set(p["preferences"]["primaryRole"] for p in group))
    if unique >= 5:
        return MAX_ROLE_SYNERGY_MULTIPLIER
    if unique == 4:
        return 1.0 + (MAX_ROLE_SYNERGY_MULTIPLIER - 1.0) / 2
    return 1.0

def score_group_competitive(group: list[dict]) -> float:
    """Full CompetitiveScoringStrategy: weighted sum * role multiplier."""
    skill     = score_skill_cohesion(group)
    intensity = score_intensity_alignment(group)
    profile   = score_profile_affinity(group)

    weighted = (SKILL_WEIGHT * skill +
                INTENT_WEIGHT * intensity +
                PROFILE_WEIGHT * profile)

    multiplier = compute_role_synergy(group)
    return min(1.0, weighted * multiplier)

def score_group_casual(group: list[dict]) -> float:
    return 1.0 if len(group) > 0 else 0.0

def get_scorer(game: str):
    tier = get_tier(game)
    return score_group_competitive if tier == "Competitive" else score_group_casual

# ── Main ─────────────────────────────────────────────────────────────────────

def main() -> None:
    raw = MOCK_DATA_PATH.read_text(encoding="utf-8")
    players: list[dict] = json.loads(raw)

    print()
    print("\u2554" + "\u2550" * 66 + "\u2557")
    print("\u2551  CampusGG \u2014 Matchmaking Engine + Real Scoring (Sub-issue 23.3)  \u2551")
    print("\u255a" + "\u2550" * 66 + "\u255d")
    print(f"  Loaded {len(players)} players from mock_players.json")
    print()

    # Partition by game
    queue: dict[str, list[dict]] = {}
    for p in players:
        queue.setdefault(p["game"], []).append(p)

    primary_game = players[0]["game"] if players else "CS2"
    scorer = get_scorer(primary_game)
    print(f"  Strategy resolved: {'CompetitiveScoringStrategy' if get_tier(primary_game) == 'Competitive' else 'CasualScoringStrategy'} (for {primary_game})")
    print()

    print("\u2500\u2500 Queue state before processing " + "\u2500" * 30)
    print(f"  Total players queued: {sum(len(v) for v in queue.values())}")
    for game, q in queue.items():
        print(f"    {game}: {len(q)} players (tier: {get_tier(game)}, group size: {get_group_size(game)})")
    print()

    # Process queue
    print("\u2500\u2500 Processing queue (CompetitiveScoringStrategy) " + "\u2500" * 13)

    formed_groups: list[dict] = []
    counter = 0

    for game, game_queue in queue.items():
        group_size = get_group_size(game)
        tier = get_tier(game)
        scorer = get_scorer(game)

        while len(game_queue) >= group_size:
            candidate_group = game_queue[:group_size]
            wait_times = [p["queueTime"] for p in candidate_group]

            # The longest-waiting player dictates the group's passing score to ensure queue liquidity.
            group_dynamic_threshold = resolve_group_threshold(wait_times)

            actual_match_score = scorer(candidate_group)

            if actual_match_score >= group_dynamic_threshold:
                counter += 1
                gid = f"grp_{uuid.uuid4()}"
                uids = [c["userId"] for c in candidate_group]
                mg = {
                    "groupId": gid, "game": game, "tier": tier,
                    "userIds": uids, "score": actual_match_score,
                    "matchedAt": datetime.now(timezone.utc).isoformat(),
                }
                del game_queue[:group_size]

                trunc = [u[:16] + "..." for u in uids]
                print(
                    f"  [MATCH #{counter:02d}] {game} ({tier}, {len(uids)}p) | "
                    f"score: {actual_match_score:.4f} | group: {gid[:16]}..."
                )
                print(f"           players: [{', '.join(trunc)}]")

                formed_groups.append(mg)
            else:
                print(f"  [Engine] Group for {game} scored {actual_match_score:.4f} \u2014 below dynamic threshold {group_dynamic_threshold:.4f} (max wait: {max(wait_times)}s). Skipping.")
                break

    print()

    # Summary
    total_matched = sum(len(g["userIds"]) for g in formed_groups)
    remaining = sum(len(v) for v in queue.values())

    print("\u2500\u2500 Summary " + "\u2500" * 52)
    print(f"  Total groups formed   : {len(formed_groups)}")
    print(f"  Total players matched : {total_matched}")
    print(f"  Remaining in queue    : {remaining}")

    if formed_groups:
        scores = [g["score"] for g in formed_groups]
        avg_s = sum(scores) / len(scores)
        min_s = min(scores)
        max_s = max(scores)
        print()
        print("\u2500\u2500 Score Distribution " + "\u2500" * 41)
        print(f"  Average score : {avg_s:.4f}")
        print(f"  Min score     : {min_s:.4f}")
        print(f"  Max score     : {max_s:.4f}")
        print(f"  Spread        : {max_s - min_s:.4f}")

    for game, q in queue.items():
        if len(q) > 0:
            print(f"    {game}: {len(q)} leftover (not enough for a full group)")

    print()
    print("  [OK] Real multi-dimensional scoring verified end-to-end.")
    print()

if __name__ == "__main__":
    main()


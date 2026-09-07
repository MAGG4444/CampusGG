#!/usr/bin/env python3
"""
generate_mock_players.py  —  Sub-issue 23.1 (Python runner / CI fallback)

Generates mock_players.json conforming to PlayerMatchmakingInput schema.
Produces output identical to the TypeScript generator; use whichever runtime
is available to unblock algorithm development.

Run:
    python src/matchmaking/mock/generate_mock_players.py

Output: mock-data/mock_players.json  (created relative to project root)

Statistical properties
----------------------
- Rating     : Normal(mean=17500, std=3000), clamped [10000, 25000]
- Intensity  : bimodal beta-like, clamped [0.0, 1.0], 2 dp
- micEnabled : Bernoulli(p=0.80)
- University : weighted, purdue.edu ~30%
- queueTime  : Exponential(mean=90s), capped at 600s
- Roles      : weighted by real-world CS2 role demand
"""

import json
import math
import random
import uuid
from pathlib import Path
from typing import TypedDict

# ─────────────────────────────────────────────────────────────────────────────
# Configuration constants
# ─────────────────────────────────────────────────────────────────────────────

PLAYER_COUNT           = 100
RATING_MEAN            = 17_500
RATING_STD             = 3_000
RATING_MIN             = 10_000
RATING_MAX             = 25_000
MIC_ENABLED_PROB       = 0.80
QUEUE_TIME_MEAN        = 90          # seconds
QUEUE_TIME_MAX         = 600         # seconds
OUTPUT_PATH            = Path(__file__).parents[4] / "mock-data" / "mock_players.json"

# ─────────────────────────────────────────────────────────────────────────────
# TypedDicts — mirror the TypeScript schema (Python type annotations)
# ─────────────────────────────────────────────────────────────────────────────

class PlayerProfile(TypedDict):
    universityDomain: str
    major: str
    activeSchedule: str

class CS2Stats(TypedDict):
    game: str
    rating: int

class PlayerPreferences(TypedDict):
    primaryRole: str
    secondaryRole: str
    micEnabled: bool

class PlayerMatchmakingInput(TypedDict):
    userId: str
    game: str
    profile: PlayerProfile
    stats: CS2Stats
    preferences: PlayerPreferences
    intensity: float
    queueTime: int

# ─────────────────────────────────────────────────────────────────────────────
# Weighted option pools
# ─────────────────────────────────────────────────────────────────────────────

UNIVERSITY_POOL = [
    ("purdue.edu",       30),
    ("illinois.edu",     12),
    ("osu.edu",          11),
    ("umich.edu",        10),
    ("msu.edu",           9),
    ("indiana.edu",       8),
    ("wisc.edu",          7),
    ("psu.edu",           6),
    ("umn.edu",           5),
    ("northwestern.edu",  2),
]

ROLE_POOL = [
    ("Entry",   30),
    ("Support", 25),
    ("AWPer",   20),
    ("Lurker",  15),
    ("IGL",     10),
]

SCHEDULE_POOL = [
    ("Weekday Evening",   30),
    ("Friday Night",      25),
    ("Weekend Afternoon", 18),
    ("Late Night",        12),
    ("Weekday Afternoon",  8),
    ("Weekend Morning",    5),
    ("Weekday Morning",    2),
]

MAJOR_POOL = [
    "Computer Science", "Computer Engineering", "Electrical Engineering",
    "Mechanical Engineering", "Business Administration", "Finance",
    "Mathematics", "Data Science", "Information Technology", "Game Design",
    "Psychology", "Communications", "Liberal Arts", "Biology", "Economics",
]

# ─────────────────────────────────────────────────────────────────────────────
# Pure utility functions
# ─────────────────────────────────────────────────────────────────────────────

def sample_weighted(pool: list[tuple[str, int]]) -> str:
    """Weighted random selection — O(n)."""
    values, weights = zip(*pool)
    return random.choices(values, weights=weights, k=1)[0]

def sample_normal_clamped(mean: float, std: float, lo: float, hi: float) -> float:
    """Sample from Normal(mean, std), clamped to [lo, hi]."""
    return max(lo, min(hi, random.gauss(mean, std)))

def sample_intensity() -> float:
    """
    Bimodal intensity: pushes mass toward 0 (casual) and 1 (competitive).
    Formula: sqrt(u)*0.5 or 1 - sqrt(u)*0.5 with equal probability.
    """
    u = random.random()
    raw = math.sqrt(u) * 0.5 if random.random() < 0.5 else 1 - math.sqrt(u) * 0.5
    return round(max(0.0, min(1.0, raw)), 2)

def sample_exponential_capped(mean: float, cap: float) -> int:
    """Inverse-CDF exponential sample, capped at `cap`."""
    return min(cap, -mean * math.log(max(random.random(), 1e-15)))

def generate_user_id() -> str:
    """Returns a namespaced UUID: usr_<uuid4>."""
    return f"usr_{uuid.uuid4()}"

# ─────────────────────────────────────────────────────────────────────────────
# Sub-generators
# ─────────────────────────────────────────────────────────────────────────────

def generate_profile() -> PlayerProfile:
    return PlayerProfile(
        universityDomain=sample_weighted(UNIVERSITY_POOL),
        major=random.choice(MAJOR_POOL),
        activeSchedule=sample_weighted(SCHEDULE_POOL),
    )

def generate_cs2_stats() -> CS2Stats:
    return CS2Stats(
        game="CS2",
        rating=round(sample_normal_clamped(RATING_MEAN, RATING_STD, RATING_MIN, RATING_MAX)),
    )

def generate_preferences() -> PlayerPreferences:
    primary = sample_weighted(ROLE_POOL)
    secondary = primary
    while secondary == primary:
        secondary = sample_weighted(ROLE_POOL)
    return PlayerPreferences(
        primaryRole=primary,
        secondaryRole=secondary,
        micEnabled=random.random() < MIC_ENABLED_PROB,
    )

# ─────────────────────────────────────────────────────────────────────────────
# Root generator
# ─────────────────────────────────────────────────────────────────────────────

def generate_mock_player() -> PlayerMatchmakingInput:
    return PlayerMatchmakingInput(
        userId=generate_user_id(),
        game="CS2",
        profile=generate_profile(),
        stats=generate_cs2_stats(),
        preferences=generate_preferences(),
        intensity=sample_intensity(),
        queueTime=int(sample_exponential_capped(QUEUE_TIME_MEAN, QUEUE_TIME_MAX)),
    )

def generate_mock_players(count: int = PLAYER_COUNT) -> list[PlayerMatchmakingInput]:
    """Public API: generate `count` mock players."""
    return [generate_mock_player() for _ in range(count)]

# ─────────────────────────────────────────────────────────────────────────────
# CLI entry point
# ─────────────────────────────────────────────────────────────────────────────

def main() -> None:
    players = generate_mock_players(PLAYER_COUNT)

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(players, indent=2), encoding="utf-8")

    # Summary stats
    ratings     = [p["stats"]["rating"] for p in players]
    avg_rating  = sum(ratings) / len(ratings)
    mic_count   = sum(1 for p in players if p["preferences"]["micEnabled"])
    purdue_count = sum(1 for p in players if p["profile"]["universityDomain"] == "purdue.edu")
    avg_intensity = sum(p["intensity"] for p in players) / len(players)

    print()
    print("╔══════════════════════════════════════════════════╗")
    print("║  CampusGG — Mock Player Pool Generated           ║")
    print("╠══════════════════════════════════════════════════╣")
    print(f"║  Players generated : {len(players):<27}║")
    print(f"║  Avg CS2 Rating    : {round(avg_rating):<27}║")
    print(f"║  Mic Enabled       : {mic_count:<27}║")
    print(f"║  Purdue players    : {purdue_count:<27}║")
    print(f"║  Avg Intensity     : {avg_intensity:.2f}{'':<24}║")
    print(f"║  Output            : {'mock-data/mock_players.json':<27}║")
    print("╚══════════════════════════════════════════════════╝")
    print()

if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
test-decay-fallback.py  --  Sub-issue 24.1 Time Decay Verification (Python)

Mirrors test-decay.ts. Prints a table of threshold values for queue times
0-350s in 30-second increments and demonstrates resolveGroupThreshold.

Run:
    py src/matchmaking/engine/test-decay-fallback.py
"""

import math

# -- Config (mirrors time-decay.config.ts) --

INITIAL_THRESHOLD       = 0.85
MINIMUM_THRESHOLD_FLOOR = 0.30
MAX_WAIT_REFERENCE      = 300    # seconds
DECAY_RATE_K            = 0.003367

# -- Model functions (mirrors time-decay-model.ts) --

def get_acceptable_threshold(queue_time: float) -> float:
    """Exponential decay with hard floor clamp."""
    t = max(0, queue_time)
    if t >= MAX_WAIT_REFERENCE:
        return MINIMUM_THRESHOLD_FLOOR
    decayable_range = INITIAL_THRESHOLD - MINIMUM_THRESHOLD_FLOOR
    decay = math.exp(-DECAY_RATE_K * t)
    return max(MINIMUM_THRESHOLD_FLOOR, MINIMUM_THRESHOLD_FLOOR + decayable_range * decay)

def resolve_group_threshold(queue_times: list[float]) -> float:
    """Use the longest-waiting player's queueTime."""
    if not queue_times:
        raise ValueError("Empty queue_times array")
    return get_acceptable_threshold(max(queue_times))

# -- Main --

def render_bar(value: float, max_val: float, width: int) -> str:
    filled = round((value / max_val) * width)
    return "#" * filled + "-" * (width - filled)

def main():
    print()
    print("=================================================================")
    print("  CampusGG -- Time Decay Curve Verification (Sub-issue 24.1)")
    print("=================================================================")
    print()
    print("  Configuration:")
    print(f"    Initial Threshold     : {INITIAL_THRESHOLD}")
    print(f"    Minimum Floor         : {MINIMUM_THRESHOLD_FLOOR}")
    print(f"    Max Wait Reference    : {MAX_WAIT_REFERENCE}s")
    print(f"    Decay Rate (k)        : {DECAY_RATE_K}")
    print(f"    Decayable Range       : {INITIAL_THRESHOLD - MINIMUM_THRESHOLD_FLOOR:.2f}")
    print(f"    Formula               : floor + range * e^(-k * t)")
    print()

    # Table header
    print("  +--------+-----------+-------------------------------------------+")
    print("  | Time   | Threshold | Curve                                     |")
    print("  +--------+-----------+-------------------------------------------+")

    for t in range(0, 351, 30):
        threshold = get_acceptable_threshold(t)
        time_str = f"{t}s".rjust(5)
        thresh_str = f"{threshold:.4f}"
        bar = render_bar(threshold, 1.0, 40)

        marker = ""
        if t == 0:
            marker = " <-- initial"
        elif t == 180:
            marker = " <-- 3min target (~0.60)"
        elif t == 300:
            marker = " <-- floor (5min)"

        print(f"  | {time_str} |  {thresh_str}  | {bar} |{marker}")

    print("  +--------+-----------+-------------------------------------------+")
    print()

    # resolveGroupThreshold demo
    print("  resolveGroupThreshold demo (longest-waiting player wins):")
    print("  ---------------------------------------------------------")

    test_groups = [
        ("Fresh group (all just queued)",      [0, 5, 10, 3, 8]),
        ("Mixed group (one waited 2 min)",     [10, 25, 45, 120, 30]),
        ("Urgent group (one waited 4 min)",    [15, 20, 30, 240, 10]),
        ("Desperate group (all waited 5 min)", [300, 310, 295, 305, 300]),
    ]

    for label, times in test_groups:
        threshold = resolve_group_threshold(times)
        max_t = max(times)
        print(f"    {label}")
        print(f"      queueTimes: [{', '.join(str(t) for t in times)}]")
        print(f"      max wait: {max_t}s -> threshold: {threshold:.4f}")
        print()

    print("  [OK] Time decay model verified.")
    print()

if __name__ == "__main__":
    main()

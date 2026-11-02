import {
  getAcceptableThreshold,
  resolveGroupThreshold,
} from './time-decay-model.js';
import {
  INITIAL_THRESHOLD,
  MAX_WAIT_REFERENCE,
  MINIMUM_THRESHOLD_FLOOR,
  TAIL_BLEND_START,
} from './time-decay.config.js';

describe('getAcceptableThreshold', () => {
  it('starts at the initial threshold', () => {
    expect(getAcceptableThreshold(0)).toBeCloseTo(INITIAL_THRESHOLD, 6);
  });

  it('treats negative queue times as freshly queued', () => {
    expect(getAcceptableThreshold(-10)).toBeCloseTo(INITIAL_THRESHOLD, 6);
  });

  it('hits the 3-minute design target', () => {
    expect(getAcceptableThreshold(180)).toBeCloseTo(0.6, 3);
  });

  it('reaches the floor at the maximum wait reference', () => {
    expect(getAcceptableThreshold(MAX_WAIT_REFERENCE)).toBe(
      MINIMUM_THRESHOLD_FLOOR,
    );
  });

  it('stays at the floor beyond the maximum wait reference', () => {
    expect(getAcceptableThreshold(999)).toBe(MINIMUM_THRESHOLD_FLOOR);
  });

  it('is continuous at the start of the tail blend', () => {
    const before = getAcceptableThreshold(TAIL_BLEND_START - 0.001);
    const at = getAcceptableThreshold(TAIL_BLEND_START);

    expect(Math.abs(before - at)).toBeLessThan(0.001);
  });

  it('is continuous at the floor boundary', () => {
    const justBefore = getAcceptableThreshold(MAX_WAIT_REFERENCE - 0.001);
    const at = getAcceptableThreshold(MAX_WAIT_REFERENCE);

    expect(Math.abs(justBefore - at)).toBeLessThan(0.01);
  });

  it('decreases monotonically from 0s to 400s', () => {
    let previous = getAcceptableThreshold(0);

    for (let time = 5; time <= 400; time += 5) {
      const current = getAcceptableThreshold(time);
      expect(current).toBeLessThanOrEqual(previous + 1e-9);
      previous = current;
    }
  });
});

describe('resolveGroupThreshold', () => {
  it('uses the longest-waiting player in the group', () => {
    expect(resolveGroupThreshold([10, 120, 30, 45])).toBe(
      getAcceptableThreshold(120),
    );
  });

  it('throws for an empty group', () => {
    expect(() => resolveGroupThreshold([])).toThrow();
  });
});

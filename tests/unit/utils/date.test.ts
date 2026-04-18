import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { calculateLookbackDate, isWithinLookback } from '../../../src/utils/date.js';

describe('calculateLookbackDate', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-18T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('lookbackDays=7 のとき7日前の0時を返す', () => {
    const result = calculateLookbackDate(7);
    expect(result.toISOString()).toBe('2026-04-11T00:00:00.000Z');
  });

  it('lookbackDays=1 のとき1日前の0時を返す', () => {
    const result = calculateLookbackDate(1);
    expect(result.toISOString()).toBe('2026-04-17T00:00:00.000Z');
  });
});

describe('isWithinLookback', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-18T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('lookbackDays より新しい記事は true を返す', () => {
    const recent = new Date('2026-04-15T00:00:00Z');
    expect(isWithinLookback(recent, 7)).toBe(true);
  });

  it('lookbackDays より古い記事は false を返す', () => {
    const old = new Date('2026-04-01T00:00:00Z');
    expect(isWithinLookback(old, 7)).toBe(false);
  });

  it('境界日と同日の記事は true を返す', () => {
    const boundary = new Date('2026-04-11T00:00:00Z');
    expect(isWithinLookback(boundary, 7)).toBe(true);
  });
});

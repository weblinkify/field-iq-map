import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { goldenSamples } from '../scripts/golden.js';
import { SHARED_DIR } from '../src/domain/model.js';
import { fnv1a, readingValue } from '../src/domain/readings.js';

describe('reading model', () => {
  it('matches FNV-1a reference vectors (same as Java)', () => {
    expect(fnv1a('')).toBe(0x811c9dc5);
    expect(fnv1a('a')).toBe(0xe40c292c);
    expect(fnv1a('foobar')).toBe(0xbf9cf968);
  });

  it('reproduces the committed golden samples', () => {
    const committed = readFileSync(`${SHARED_DIR}/fixtures/readings-golden.json`, 'utf8');
    expect(JSON.parse(committed)).toEqual(goldenSamples());
  });

  it('elevates alert sensors above thresholds', () => {
    const t = Date.parse('2026-07-01T10:00:00Z') / 1000;
    const alert = {
      id: 'FIQ-00007',
      lat: 60.2,
      municipality: 'Helsinki',
      status: 'ALERT' as const,
    };
    expect(readingValue(alert, 'PM25', t)).toBeGreaterThan(25);
    expect(readingValue(alert, 'HUMIDITY', t)).toBeGreaterThanOrEqual(93);
  });
});

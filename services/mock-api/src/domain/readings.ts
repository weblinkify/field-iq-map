/**
 * Deterministic reading model — a line-by-line port of
 * services/api/src/main/java/io/fieldiq/api/domain/ReadingModel.java.
 * Both are checked against shared/fixtures/readings-golden.json.
 */
import type { Metric, SensorStatus } from '../generated/graphql.js';

export const POPULATION_CENTRES: ReadonlySet<string> = new Set([
  'Helsinki',
  'Espoo',
  'Tampere',
  'Turku',
  'Oulu',
  'Jyväskylä',
  'Kuopio',
  'Lahti',
  'Rovaniemi',
]);

export interface SensorProfile {
  id: string;
  lat: number;
  municipality: string;
  status: SensorStatus;
}

/** 32-bit FNV-1a over UTF-16 code units (Java: String.charAt). */
export function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

const unit01 = (s: string) => fnv1a(s) / 4294967296;
const floorMod = (x: number, m: number) => ((x % m) + m) % m;
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

/** Value of `metric` for `sensor` at `epochSecond`, rounded to 0.1. */
export function readingValue(sensor: SensorProfile, metric: Metric, epochSecond: number): number {
  const urban = POPULATION_CENTRES.has(sensor.municipality) ? 1.0 : 0.35;
  const hour = floorMod(epochSecond / 3600.0 + 2, 24);
  const day = Math.sin((2 * Math.PI * (hour - 9)) / 24);
  const rush =
    Math.exp(-((hour - 8) * (hour - 8)) / 2) + Math.exp(-((hour - 17) * (hour - 17)) / 2);
  const offset = unit01(`${sensor.id}|${metric}`) - 0.5;
  const jitter = unit01(`${sensor.id}|${metric}|${Math.floor(epochSecond / 300)}`) - 0.5;
  const alert = sensor.status === 'ALERT';

  let v: number;
  switch (metric) {
    case 'TEMPERATURE': {
      const t = 12 - (sensor.lat - 60) * 1.4 + 5 * day + 3 * offset + 0.8 * jitter;
      v = alert ? t + 22 : t;
      break;
    }
    case 'HUMIDITY': {
      const h = clamp(72 - 14 * day + 10 * offset + 3 * jitter, 15, 100);
      v = alert ? Math.max(h, 93) : h;
      break;
    }
    case 'NOISE': {
      const n = 34 + 16 * urban + 12 * urban * rush - (hour < 6 ? 6 : 0) + 6 * offset + 3 * jitter;
      v = alert ? n + 30 : n;
      break;
    }
    case 'PM25': {
      const p = Math.max(0.5, 4 + 7 * urban + 6 * urban * rush + 4 * offset + 1.5 * jitter);
      v = alert ? p * 3 + 20 : p;
      break;
    }
  }
  return Math.round(v * 10) / 10;
}

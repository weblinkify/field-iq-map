import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AlertSeverity, Metric, SensorStatus, SensorType } from '../generated/graphql.js';

/** shared/ directory: FIELDIQ_SHARED_DIR in Docker, the repo checkout otherwise. */
export const SHARED_DIR =
  process.env['FIELDIQ_SHARED_DIR'] ??
  resolve(fileURLToPath(import.meta.url), '../../../../../shared');

/** Shape of shared/fixtures/sensors.json. */
export interface Fixture {
  sites: FixtureSite[];
  sensors: FixtureSensor[];
  alerts: FixtureAlert[];
}

export interface FixtureSite {
  id: string;
  name: string;
  municipality: string;
  region: string;
  lat: number;
  lon: number;
}

export interface FixtureSensor {
  id: string;
  name: string;
  type: SensorType;
  status: SensorStatus;
  lat: number;
  lon: number;
  municipality: string;
  region: string;
  siteId: string;
  siteName: string;
  installedAt: string;
  batteryPct: number;
  firmware: string;
  lastSeenSecondsAgo: number;
}

export interface FixtureAlert {
  id: string;
  sensorId: string;
  severity: AlertSeverity;
  message: string;
  createdSecondsAgo: number;
  resolvedSecondsAgo: number | null;
}

/** Resolver parent types (codegen mappers). */
export type SensorModel = FixtureSensor;
export interface SiteModel extends FixtureSite {
  sensorCount: number;
}
export interface AlertModel extends FixtureAlert {
  sensorName: string;
}

export const METRICS_BY_TYPE: Record<SensorType, readonly Metric[]> = {
  TEMPERATURE: ['TEMPERATURE'],
  HUMIDITY: ['HUMIDITY'],
  NOISE: ['NOISE'],
  AIR_QUALITY_PM25: ['PM25'],
  MULTI: ['TEMPERATURE', 'HUMIDITY', 'NOISE', 'PM25'],
};

export const UNITS: Record<Metric, string> = {
  TEMPERATURE: '°C',
  HUMIDITY: '%',
  NOISE: 'dB',
  PM25: 'µg/m³',
};

export const SENSOR_TYPES: readonly SensorType[] = [
  'TEMPERATURE',
  'HUMIDITY',
  'NOISE',
  'AIR_QUALITY_PM25',
  'MULTI',
];
export const SENSOR_STATUSES: readonly SensorStatus[] = [
  'ONLINE',
  'OFFLINE',
  'ALERT',
  'LOW_BATTERY',
];
export const METRICS: readonly Metric[] = ['TEMPERATURE', 'HUMIDITY', 'NOISE', 'PM25'];

export const primaryMetric = (type: SensorType): Metric =>
  type === 'MULTI' ? 'PM25' : (METRICS_BY_TYPE[type][0] as Metric);

export function loadFixture(path = `${SHARED_DIR}/fixtures/sensors.json`): Fixture {
  return JSON.parse(readFileSync(path, 'utf8')) as Fixture;
}

/** ISO-8601 UTC with second precision — identical to the Java API's Instant output. */
export const isoSeconds = (date: Date): string => date.toISOString().replace(/\.\d{3}Z$/, 'Z');

export const truncateToSeconds = (ms: number): Date => new Date(Math.floor(ms / 1000) * 1000);

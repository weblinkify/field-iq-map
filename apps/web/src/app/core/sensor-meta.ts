import type { Metric, SensorStatus, SensorType } from '../api/generated/graphql';

/** Status colours shared by the map layers, legend and badges (WCAG AA on the dark UI). */
export const STATUS_COLORS: Record<SensorStatus, string> = {
  ONLINE: '#22c55e',
  ALERT: '#ef4444',
  OFFLINE: '#94a3b8',
  LOW_BATTERY: '#f59e0b',
};

export const STATUS_LABELS: Record<SensorStatus, string> = {
  ONLINE: 'Online',
  ALERT: 'Alert',
  OFFLINE: 'Offline',
  LOW_BATTERY: 'Low battery',
};

export const TYPE_LABELS: Record<SensorType, string> = {
  TEMPERATURE: 'Temperature',
  HUMIDITY: 'Humidity',
  NOISE: 'Noise',
  AIR_QUALITY_PM25: 'Air quality (PM2.5)',
  MULTI: 'Multisensor',
};

/** One-letter glyph drawn on each point at high zoom (shape per sensor type). */
export const TYPE_GLYPHS: Record<SensorType, string> = {
  TEMPERATURE: 'T',
  HUMIDITY: 'H',
  NOISE: 'N',
  AIR_QUALITY_PM25: 'P',
  MULTI: 'M',
};

export const METRIC_LABELS: Record<Metric, string> = {
  TEMPERATURE: 'Temperature',
  HUMIDITY: 'Humidity',
  NOISE: 'Noise',
  PM25: 'PM2.5',
};

export const SENSOR_STATUSES: readonly SensorStatus[] = [
  'ONLINE',
  'ALERT',
  'LOW_BATTERY',
  'OFFLINE',
];
export const SENSOR_TYPES: readonly SensorType[] = [
  'TEMPERATURE',
  'HUMIDITY',
  'NOISE',
  'AIR_QUALITY_PM25',
  'MULTI',
];

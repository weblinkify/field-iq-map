import type { Metric } from '../api/generated/graphql';

const DECIMALS: Record<Metric, number> = { TEMPERATURE: 1, HUMIDITY: 0, NOISE: 0, PM25: 1 };

/** "21.4 °C", "64 %", "52 dB", "8.3 µg/m³", or "—" when there is no value. */
export function formatValue(
  value: number | null | undefined,
  unit: string,
  metric?: Metric,
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  const decimals = metric ? DECIMALS[metric] : 1;
  return `${value.toFixed(decimals)} ${unit}`;
}

/** "just now", "45 s ago", "12 min ago", "3 h ago", "5 d ago". */
export function relativeTime(iso: string | null | undefined, now: number = Date.now()): string {
  if (!iso) return '—';
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return '—';
  const seconds = Math.max(0, Math.round((now - then) / 1000));
  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds} s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.floor(hours / 24)} d ago`;
}

export function formatPercent(part: number, total: number): string {
  if (total <= 0) return '0 %';
  return `${((part / total) * 100).toFixed(1)} %`;
}

export function formatCoordinates(lat: number, lon: number): string {
  return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
}

export const formatCount = (n: number): string => n.toLocaleString('en-US');

import type {
  MetricAverage,
  Metric,
  RegionSummary,
  SensorStatus,
  SensorType,
} from '../generated/graphql.js';
import {
  METRICS,
  METRICS_BY_TYPE,
  primaryMetric,
  SENSOR_STATUSES,
  SENSOR_TYPES,
  truncateToSeconds,
  UNITS,
  type AlertModel,
  type Fixture,
  type FixtureSensor,
  type SiteModel,
} from './model.js';
import { readingValue } from './readings.js';

export class InvalidRequestError extends Error {}
export class NotFoundError extends Error {}

export interface BBox {
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
}

export interface Criteria {
  bbox?: BBox | null;
  types?: readonly SensorType[] | null;
  statuses?: readonly SensorStatus[] | null;
  regions?: readonly string[] | null;
  search?: string | null;
}

export interface Reading {
  sensorId: string;
  ts: Date;
  metric: Metric;
  value: number;
  unit: string;
}

export interface Stats {
  total: number;
  byStatus: { status: SensorStatus; count: number }[];
  byType: { type: SensorType; count: number }[];
  averages: MetricAverage[];
  activeAlerts: number;
  regionsCovered: number;
}

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 200;
const HOUR_MS = 3_600_000;
const DEFAULT_WINDOW_MS = 24 * HOUR_MS;
const MAX_WINDOW_MS = 31 * 24 * HOUR_MS;

/** Validates a bbox exactly like services/api BBox.java. */
export function validateBBox(b: BBox): BBox {
  const values = [b.minLon, b.minLat, b.maxLon, b.maxLat];
  if (!values.every(Number.isFinite))
    throw new InvalidRequestError('bbox values must be finite numbers');
  if (b.minLon < -180 || b.maxLon > 180)
    throw new InvalidRequestError('bbox longitude must be within -180..180');
  if (b.minLat < -90 || b.maxLat > 90)
    throw new InvalidRequestError('bbox latitude must be within -90..90');
  if (b.minLon >= b.maxLon || b.minLat >= b.maxLat)
    throw new InvalidRequestError('bbox min values must be smaller than max values');
  return b;
}

export function parseBBox(value: string | undefined): BBox | null {
  if (value === undefined || value.trim() === '') return null;
  const parts = value.split(',');
  if (parts.length !== 4) throw new InvalidRequestError('bbox must be minLon,minLat,maxLon,maxLat');
  const n = parts.map((p) => (p.trim() === '' ? NaN : Number(p.trim())));
  if (n.some((x) => Number.isNaN(x)))
    throw new InvalidRequestError('bbox must contain four numbers');
  const [minLon, minLat, maxLon, maxLat] = n as [number, number, number, number];
  return validateBBox({ minLon, minLat, maxLon, maxLat });
}

export const encodeCursor = (id: string) => Buffer.from(`sensor:${id}`, 'utf8').toString('base64');

export function decodeCursor(cursor: string | null | undefined): string | null {
  if (cursor === null || cursor === undefined) return null;
  const raw = /^[A-Za-z0-9+/]+={0,2}$/.test(cursor)
    ? Buffer.from(cursor, 'base64').toString('utf8')
    : '';
  if (raw.startsWith('sensor:') && raw.length > 'sensor:'.length)
    return raw.slice('sensor:'.length);
  throw new InvalidRequestError('Invalid cursor');
}

const round2 = (v: number) => Math.round(v * 100) / 100;
const byCodePoint = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * In-memory implementation of the FieldIQ queries over shared/fixtures/sensors.json.
 * Relative fixture times are anchored at `now()` on every call, so data always looks live.
 */
export class SensorStore {
  readonly sensors: readonly FixtureSensor[];
  private readonly byId: Map<string, FixtureSensor>;
  private readonly sites: SiteModel[];
  private readonly sitesById: Map<string, SiteModel>;
  private readonly alerts: AlertModel[];
  private readonly alertsBySensor: Map<string, AlertModel[]>;

  constructor(
    fixture: Fixture,
    private readonly now: () => number = Date.now,
  ) {
    this.sensors = [...fixture.sensors].sort((a, b) => byCodePoint(a.id, b.id));
    this.byId = new Map(this.sensors.map((s) => [s.id, s]));
    const counts = new Map<string, number>();
    for (const s of this.sensors) counts.set(s.siteId, (counts.get(s.siteId) ?? 0) + 1);
    this.sites = fixture.sites
      .map((s) => ({ ...s, sensorCount: counts.get(s.id) ?? 0 }))
      .sort((a, b) => byCodePoint(a.id, b.id));
    this.sitesById = new Map(this.sites.map((s) => [s.id, s]));
    this.alerts = fixture.alerts
      .map((a) => ({ ...a, sensorName: this.byId.get(a.sensorId)?.name ?? a.sensorId }))
      .sort((a, b) => a.createdSecondsAgo - b.createdSecondsAgo || byCodePoint(a.id, b.id));
    this.alertsBySensor = new Map();
    for (const a of this.alerts) {
      const list = this.alertsBySensor.get(a.sensorId) ?? [];
      list.push(a);
      this.alertsBySensor.set(a.sensorId, list);
    }
  }

  // ── time helpers ──────────────────────────────────────────────────────────────────────
  nowDate(): Date {
    return truncateToSeconds(this.now());
  }

  lastSeenAt(s: FixtureSensor): Date {
    return new Date(this.nowDate().getTime() - s.lastSeenSecondsAgo * 1000);
  }

  ago(seconds: number): Date {
    return new Date(this.nowDate().getTime() - seconds * 1000);
  }

  // ── sensors ───────────────────────────────────────────────────────────────────────────
  sensor(id: string): FixtureSensor | undefined {
    return this.byId.get(id);
  }

  requireSensor(id: string): FixtureSensor {
    const s = this.byId.get(id);
    if (!s) throw new NotFoundError(`Sensor ${id} not found`);
    return s;
  }

  filter(c: Criteria): FixtureSensor[] {
    const q = c.search?.trim().toLowerCase() || null;
    const types = c.types?.length ? new Set(c.types) : null;
    const statuses = c.statuses?.length ? new Set(c.statuses) : null;
    const regions = c.regions?.length ? new Set(c.regions) : null;
    const b = c.bbox ?? null;
    return this.sensors.filter(
      (s) =>
        (!b ||
          (s.lon >= b.minLon && s.lon <= b.maxLon && s.lat >= b.minLat && s.lat <= b.maxLat)) &&
        (!types || types.has(s.type)) &&
        (!statuses || statuses.has(s.status)) &&
        (!regions || regions.has(s.region)) &&
        (!q ||
          s.id.toLowerCase().includes(q) ||
          s.name.toLowerCase().includes(q) ||
          s.municipality.toLowerCase().includes(q) ||
          s.siteName.toLowerCase().includes(q)),
    );
  }

  page(c: Criteria, first: number | null | undefined, after: string | null | undefined) {
    const size = first ?? DEFAULT_PAGE_SIZE;
    if (!Number.isInteger(size) || size < 1 || size > MAX_PAGE_SIZE)
      throw new InvalidRequestError(`first must be between 1 and ${MAX_PAGE_SIZE}`);
    const afterId = decodeCursor(after);
    const all = this.filter(c);
    const start = afterId === null ? 0 : all.findIndex((s) => s.id > afterId);
    const rest = start < 0 ? [] : all.slice(start);
    return { items: rest.slice(0, size), hasNextPage: rest.length > size, totalCount: all.length };
  }

  // ── readings ──────────────────────────────────────────────────────────────────────────
  latestReadings(s: FixtureSensor): Reading[] {
    const ts = this.lastSeenAt(s);
    return [...METRICS_BY_TYPE[s.type]]
      .sort(byCodePoint)
      .map((metric) => this.reading(s, metric, ts));
  }

  latestPrimary(s: FixtureSensor): Reading {
    return this.reading(s, primaryMetric(s.type), this.lastSeenAt(s));
  }

  /** Hourly history within [from, to], up to the sensor's last report. Ordered by ts, metric. */
  readings(
    s: FixtureSensor,
    from?: Date | null,
    to?: Date | null,
    metric?: Metric | null,
  ): Reading[] {
    const end = to ?? this.nowDate();
    const start = from ?? new Date(end.getTime() - DEFAULT_WINDOW_MS);
    if (!(start.getTime() < end.getTime())) throw new InvalidRequestError('from must be before to');
    if (end.getTime() - start.getTime() > MAX_WINDOW_MS)
      throw new InvalidRequestError('The readings window is limited to 31 days');
    // Reporting sensors have history up to now; offline ones stop at their last report.
    const limit = Math.min(
      end.getTime(),
      s.status === 'OFFLINE' ? this.lastSeenAt(s).getTime() : this.nowDate().getTime(),
    );
    const metrics = [...METRICS_BY_TYPE[s.type]]
      .filter((m) => !metric || m === metric)
      .sort(byCodePoint);
    const out: Reading[] = [];
    for (let t = Math.ceil(start.getTime() / HOUR_MS) * HOUR_MS; t <= limit; t += HOUR_MS) {
      for (const m of metrics) out.push(this.reading(s, m, new Date(t)));
    }
    return out;
  }

  private reading(s: FixtureSensor, metric: Metric, ts: Date): Reading {
    return {
      sensorId: s.id,
      ts,
      metric,
      value: readingValue(s, metric, Math.floor(ts.getTime() / 1000)),
      unit: UNITS[metric],
    };
  }

  // ── aggregates ────────────────────────────────────────────────────────────────────────
  stats(c: Criteria): Stats {
    const sensors = this.filter(c);
    const ids = new Set(sensors.map((s) => s.id));
    const sums = new Map<Metric, { sum: number; n: number }>();
    for (const s of sensors) {
      if (s.status === 'OFFLINE') continue;
      for (const r of this.latestReadings(s)) {
        const acc = sums.get(r.metric) ?? { sum: 0, n: 0 };
        acc.sum += r.value;
        acc.n++;
        sums.set(r.metric, acc);
      }
    }
    return {
      total: sensors.length,
      byStatus: SENSOR_STATUSES.map((status) => ({
        status,
        count: sensors.filter((s) => s.status === status).length,
      })),
      byType: SENSOR_TYPES.map((type) => ({
        type,
        count: sensors.filter((s) => s.type === type).length,
      })),
      averages: METRICS.map((metric) => {
        const acc = sums.get(metric);
        return {
          metric,
          average: acc ? round2(acc.sum / acc.n) : null,
          unit: UNITS[metric],
          sampleSize: acc?.n ?? 0,
        };
      }),
      activeAlerts: this.alerts.filter((a) => a.resolvedSecondsAgo === null && ids.has(a.sensorId))
        .length,
      regionsCovered: new Set(sensors.map((s) => s.region)).size,
    };
  }

  regions(): RegionSummary[] {
    const map = new Map<string, RegionSummary>();
    for (const s of this.sensors) {
      const r = map.get(s.region) ?? {
        region: s.region,
        sensorCount: 0,
        onlineCount: 0,
        alertCount: 0,
      };
      r.sensorCount++;
      if (s.status === 'ONLINE') r.onlineCount++;
      if (s.status === 'ALERT') r.alertCount++;
      map.set(s.region, r);
    }
    return [...map.values()].sort((a, b) => byCodePoint(a.region, b.region));
  }

  // ── sites & alerts ────────────────────────────────────────────────────────────────────
  site(id: string): SiteModel | undefined {
    return this.sitesById.get(id);
  }

  sitesIn(region?: string | null): SiteModel[] {
    return region ? this.sites.filter((s) => s.region === region) : this.sites;
  }

  alertList(activeOnly: boolean, first: number): AlertModel[] {
    if (!Number.isInteger(first) || first < 1 || first > 1000)
      throw new InvalidRequestError('first must be between 1 and 1000');
    return this.alerts.filter((a) => !activeOnly || a.resolvedSecondsAgo === null).slice(0, first);
  }

  alertsFor(sensorId: string, activeOnly: boolean): AlertModel[] {
    return (this.alertsBySensor.get(sensorId) ?? []).filter(
      (a) => !activeOnly || a.resolvedSecondsAgo === null,
    );
  }
}

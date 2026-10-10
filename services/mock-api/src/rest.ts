import { Router, type NextFunction, type Request, type Response } from 'express';
import type { components } from './generated/openapi.js';
import { isoSeconds, SENSOR_STATUSES, SENSOR_TYPES, UNITS } from './domain/model.js';
import {
  InvalidRequestError,
  NotFoundError,
  parseBBox,
  type Criteria,
  type Reading,
  type SensorStore,
} from './domain/store.js';
import type { Metric, SensorStatus, SensorType } from './generated/graphql.js';

type Schemas = components['schemas'];
type ProblemDetail = Schemas['ProblemDetail'];

const PROBLEM = 'https://fieldiq.dev/problems/';
const GEO_JSON = 'application/geo+json';
const CSV_HEADER =
  'id,name,type,status,lat,lon,municipality,region,site,battery_pct,firmware,last_seen_at,metric,value,unit';
const METRIC_VALUES: readonly Metric[] = ['TEMPERATURE', 'HUMIDITY', 'NOISE', 'PM25'];

/** Accepts `?type=A,B` and `?type=A&type=B` like Spring does. */
function list(value: unknown): string[] {
  const raw = Array.isArray(value) ? value : value === undefined ? [] : [value];
  return raw
    .flatMap((v) => String(v).split(','))
    .map((v) => v.trim())
    .filter((v) => v !== '');
}

function enumList<T extends string>(value: unknown, allowed: readonly T[], name: string): T[] {
  return list(value).map((v) => {
    if (!(allowed as readonly string[]).includes(v))
      throw new InvalidRequestError(`Invalid value '${v}' for parameter '${name}'`);
    return v as T;
  });
}

function single(value: unknown): string | undefined {
  return Array.isArray(value) ? String(value[0]) : value === undefined ? undefined : String(value);
}

function criteria(req: Request): Criteria {
  return {
    bbox: parseBBox(single(req.query['bbox'])),
    types: enumList<SensorType>(req.query['type'], SENSOR_TYPES, 'type'),
    statuses: enumList<SensorStatus>(req.query['status'], SENSOR_STATUSES, 'status'),
    regions: list(req.query['region']),
  };
}

function date(value: unknown, name: string): Date | null {
  const v = single(value);
  if (v === undefined) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime()))
    throw new InvalidRequestError(`Invalid value '${v}' for parameter '${name}'`);
  return d;
}

const toReading = (r: Reading): Schemas['Reading'] => ({ ...r, ts: isoSeconds(r.ts) });

function csvEscape(value: string): string {
  const v = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/** Java's Double.toString for our 0.1/5-decimal values ("52.0", "60.1885"). */
const javaDouble = (n: number) => (Number.isInteger(n) ? n.toFixed(1) : String(n));

export function createRestRouter(store: SensorStore): Router {
  const router = Router();

  router.get('/health', (_req, res) => {
    const body: Schemas['HealthResponse'] = {
      status: 'UP',
      mode: 'mock',
      version: '2.0.0',
      time: isoSeconds(store.nowDate()),
    };
    res.json(body);
  });

  router.get('/sensors.geojson', (req, res) => {
    const features = store.filter(criteria(req)).map((s): Schemas['SensorFeature'] => {
      const primary = store.latestPrimary(s);
      const pm25 = primary.metric === 'PM25' ? primary.value : null;
      return {
        type: 'Feature',
        id: s.id,
        geometry: { type: 'Point', coordinates: [s.lon, s.lat] },
        properties: {
          id: s.id,
          name: s.name,
          type: s.type,
          status: s.status,
          municipality: s.municipality,
          region: s.region,
          siteName: s.siteName,
          batteryPct: s.batteryPct,
          lastSeenAt: isoSeconds(store.lastSeenAt(s)),
          metric: primary.metric,
          value: primary.value,
          unit: primary.unit,
          pm25,
        },
      };
    });
    const body: Schemas['SensorFeatureCollection'] = { type: 'FeatureCollection', features };
    res.type(GEO_JSON).send(JSON.stringify(body));
  });

  router.get('/sensors/:id', (req, res) => {
    const s = store.requireSensor(req.params['id'] ?? '');
    const body: Schemas['SensorDetail'] = {
      id: s.id,
      name: s.name,
      type: s.type,
      status: s.status,
      location: { lat: s.lat, lon: s.lon },
      municipality: s.municipality,
      region: s.region,
      siteId: s.siteId,
      siteName: s.siteName,
      installedAt: isoSeconds(new Date(s.installedAt)),
      batteryPct: s.batteryPct,
      firmware: s.firmware,
      lastSeenAt: isoSeconds(store.lastSeenAt(s)),
      latestReadings: store.latestReadings(s).map(toReading),
    };
    res.json(body);
  });

  router.get('/sensors/:id/readings', (req, res) => {
    const s = store.requireSensor(req.params['id'] ?? '');
    const metric = enumList<Metric>(req.query['metric'], METRIC_VALUES, 'metric')[0] ?? null;
    const body: Schemas['Reading'][] = store
      .readings(s, date(req.query['from'], 'from'), date(req.query['to'], 'to'), metric)
      .map(toReading);
    res.json(body);
  });

  router.get('/export/sensors.csv', (req, res) => {
    const rows = store.filter(criteria(req)).map((s) => {
      const p = store.latestPrimary(s);
      return [
        csvEscape(s.id),
        csvEscape(s.name),
        s.type,
        s.status,
        javaDouble(s.lat),
        javaDouble(s.lon),
        csvEscape(s.municipality),
        csvEscape(s.region),
        csvEscape(s.siteName),
        String(s.batteryPct),
        csvEscape(s.firmware),
        isoSeconds(store.lastSeenAt(s)),
        p.metric,
        javaDouble(p.value),
        csvEscape(UNITS[p.metric]),
      ].join(',');
    });
    res
      .type('text/csv; charset=utf-8')
      .attachment('fieldiq-sensors.csv')
      .send([CSV_HEADER, ...rows].map((l) => `${l}\r\n`).join(''));
  });

  router.use((req) => {
    throw new NotFoundError(`No endpoint ${req.method} ${req.originalUrl}`);
  });

  router.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) return next(err);
    const problem = toProblem(err, req.originalUrl.split('?')[0] ?? '');
    res
      .status(problem.status ?? 500)
      .type('application/problem+json')
      .send(JSON.stringify(problem));
  });

  return router;
}

function toProblem(err: unknown, instance: string): ProblemDetail {
  if (err instanceof InvalidRequestError)
    return {
      type: `${PROBLEM}invalid-request`,
      title: 'Invalid request',
      status: 400,
      detail: err.message,
      instance,
    };
  if (err instanceof NotFoundError)
    return {
      type: `${PROBLEM}not-found`,
      title: 'Not found',
      status: 404,
      detail: err.message,
      instance,
    };
  console.error(err);
  return {
    type: 'about:blank',
    title: 'Internal Server Error',
    status: 500,
    detail: 'Unexpected error',
    instance,
  };
}

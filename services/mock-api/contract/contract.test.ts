/**
 * Contract tests: the same REST calls and GraphQL operations against the mock API and the real
 * Spring Boot API must return the same shapes, and the same values wherever data is deterministic
 * (ids, names, counts, aggregates over the shared fixture).
 *
 *   MOCK_URL=http://localhost:4000 REAL_URL=http://localhost:8081 npm run test:contract
 */
import { describe, expect, it } from 'vitest';
import { shape } from './shape.js';

const MOCK_URL = process.env['MOCK_URL'];
const REAL_URL = process.env['REAL_URL'];
const targets = MOCK_URL && REAL_URL ? { mock: MOCK_URL, real: REAL_URL } : null;
const HELSINKI = '24.70,60.10,25.25,60.35';

interface HttpResult {
  status: number;
  contentType: string;
  text: string;
}

async function get(base: string, path: string): Promise<HttpResult> {
  const res = await fetch(`${base}${path}`);
  return {
    status: res.status,
    contentType: res.headers.get('content-type') ?? '',
    text: await res.text(),
  };
}

async function both(path: string) {
  if (!targets) throw new Error('contract targets not configured');
  const [mock, real] = await Promise.all([get(targets.mock, path), get(targets.real, path)]);
  return { mock, real };
}

async function gqlBoth(query: string, variables: Record<string, unknown> = {}) {
  if (!targets) throw new Error('contract targets not configured');
  const call = async (base: string) => {
    const res = await fetch(`${base}/graphql`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ query, variables }),
    });
    return (await res.json()) as { data?: Record<string, unknown>; errors?: unknown[] };
  };
  const [mock, real] = await Promise.all([call(targets.mock), call(targets.real)]);
  return { mock, real };
}

const mediaType = (contentType: string) => contentType.split(';')[0]?.trim();

describe.skipIf(!targets)('mock ↔ real contract', () => {
  describe('REST', () => {
    it.each([
      '/api/v1/health',
      `/api/v1/sensors.geojson?bbox=${HELSINKI}`,
      '/api/v1/sensors.geojson?type=MULTI&status=ALERT',
      '/api/v1/sensors/FIQ-00042',
      '/api/v1/sensors/FIQ-00042/readings',
    ])('GET %s has the same status, media type and shape', async (path) => {
      const { mock, real } = await both(path);
      expect(mock.status).toBe(200);
      expect(real.status).toBe(200);
      expect(mediaType(mock.contentType)).toBe(mediaType(real.contentType));
      expect(shape(JSON.parse(mock.text))).toEqual(shape(JSON.parse(real.text)));
    });

    it('GeoJSON returns identical features for the same bbox', async () => {
      const { mock, real } = await both(`/api/v1/sensors.geojson?bbox=${HELSINKI}`);
      const ids = (t: string) =>
        (JSON.parse(t) as { features: { id: string; geometry: unknown }[] }).features.map((f) => [
          f.id,
          f.geometry,
        ]);
      expect(ids(mock.text)).toEqual(ids(real.text));
    });

    it('sensor detail agrees on static fields', async () => {
      const { mock, real } = await both('/api/v1/sensors/FIQ-00042');
      const pick = (t: string) => {
        const {
          lastSeenAt: _a,
          latestReadings: _b,
          ...rest
        } = JSON.parse(t) as Record<string, unknown>;
        return rest;
      };
      expect(pick(mock.text)).toEqual(pick(real.text));
    });

    it.each([
      '/api/v1/sensors.geojson?bbox=1,2,3',
      '/api/v1/sensors.geojson?bbox=25,60,24,61',
      '/api/v1/sensors/FIQ-99999',
      '/api/v1/sensors/FIQ-99999/readings',
    ])('error %s is problem+json in both', async (path) => {
      const { mock, real } = await both(path);
      expect(mock.status).toBe(real.status);
      expect(mediaType(mock.contentType)).toBe('application/problem+json');
      expect(mediaType(real.contentType)).toBe('application/problem+json');
      const m = JSON.parse(mock.text) as Record<string, unknown>;
      const r = JSON.parse(real.text) as Record<string, unknown>;
      expect(shape(m)).toEqual(shape(r));
      expect(m['type']).toBe(r['type']);
      expect(m['title']).toBe(r['title']);
    });

    it('CSV export has the same header and rows', async () => {
      const { mock, real } = await both(`/api/v1/export/sensors.csv?bbox=${HELSINKI}`);
      expect(mediaType(mock.contentType)).toBe('text/csv');
      expect(mediaType(real.contentType)).toBe('text/csv');
      const firstColumns = (t: string) =>
        t
          .split('\r\n')
          .filter(Boolean)
          .map((l) => l.split(',').slice(0, 6).join(','));
      expect(firstColumns(mock.text)).toEqual(firstColumns(real.text));
    });
  });

  describe('GraphQL', () => {
    const SENSOR_FIELDS = `id name type status municipality region siteName batteryPct firmware
      installedAt lastSeenAt location { lat lon }
      site { id name municipality region sensorCount location { lat lon } }
      latestReadings { sensorId ts metric value unit }
      readings { sensorId ts metric value unit }
      alerts { id sensorId sensorName severity message createdAt resolvedAt }`;

    it('sensor(id) has the same shape and static values', async () => {
      const { mock, real } = await gqlBoth(
        `query($id: ID!) { sensor(id: $id) { ${SENSOR_FIELDS} } }`,
        {
          id: 'FIQ-00042',
        },
      );
      expect(mock.errors).toBeUndefined();
      expect(real.errors).toBeUndefined();
      expect(shape(mock.data)).toEqual(shape(real.data));
      const stable = (d: Record<string, unknown> | undefined) => {
        const s = d?.['sensor'] as Record<string, unknown>;
        return [s['name'], s['site'], (s['alerts'] as { id: string }[]).map((a) => a.id)];
      };
      expect(stable(mock.data)).toEqual(stable(real.data));
    });

    it('sensors() pagination returns the same pages', async () => {
      const query = `query($after: String) {
        sensors(filter: { statuses: [ALERT], regions: ["Uusimaa"] }, first: 25, after: $after) {
          totalCount pageInfo { hasNextPage endCursor } edges { cursor node { id name } }
        } }`;
      let after: string | null = null;
      for (let page = 0; page < 3; page++) {
        const { mock, real } = await gqlBoth(query, { after });
        expect(mock.data).toEqual(real.data);
        const conn = mock.data?.['sensors'] as {
          pageInfo: { endCursor: string | null; hasNextPage: boolean };
        };
        if (!conn.pageInfo.hasNextPage) break;
        after = conn.pageInfo.endCursor;
      }
    });

    it('sensorStats(bbox) agrees on counts and shape', async () => {
      const { mock, real } = await gqlBoth(`{
        sensorStats(bbox: { minLon: 24.70, minLat: 60.10, maxLon: 25.25, maxLat: 60.35 }) {
          total activeAlerts regionsCovered
          byStatus { status count } byType { type count }
          averages { metric average unit sampleSize }
        } }`);
      expect(shape(mock.data)).toEqual(shape(real.data));
      const counts = (d: Record<string, unknown> | undefined) => {
        const { averages, ...rest } = d?.['sensorStats'] as Record<string, unknown>;
        return {
          ...rest,
          samples: (averages as { sampleSize: number }[]).map((a) => a.sampleSize),
        };
      };
      expect(counts(mock.data)).toEqual(counts(real.data));
    });

    it('regions, sites and active alerts are identical', async () => {
      const { mock, real } = await gqlBoth(`{
        regions { region sensorCount onlineCount alertCount }
        sites { id name municipality region sensorCount location { lat lon } }
        alerts(first: 50) { id sensorId sensorName severity message }
      }`);
      expect(mock.data).toEqual(real.data);
    });

    it('invalid input is classified as BAD_REQUEST in both', async () => {
      const { mock, real } = await gqlBoth('{ sensors(first: 500) { totalCount } }');
      const classification = (r: { errors?: unknown[] }) =>
        (r.errors?.[0] as { extensions?: { classification?: string } } | undefined)?.extensions
          ?.classification;
      expect(classification(mock)).toBe('BAD_REQUEST');
      expect(classification(real)).toBe('BAD_REQUEST');
    });
  });
});

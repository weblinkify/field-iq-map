import { describe, expect, it } from 'vitest';
import { loadFixture } from '../src/domain/model.js';
import {
  decodeCursor,
  encodeCursor,
  InvalidRequestError,
  NotFoundError,
  parseBBox,
  SensorStore,
} from '../src/domain/store.js';

const NOW = Date.parse('2026-10-10T12:34:56.789Z');
const store = new SensorStore(loadFixture(), () => NOW);

describe('parseBBox', () => {
  it('parses four numbers', () => {
    expect(parseBBox(' 24.5, 60.1,25.3 ,60.4')).toEqual({
      minLon: 24.5,
      minLat: 60.1,
      maxLon: 25.3,
      maxLat: 60.4,
    });
    expect(parseBBox(undefined)).toBeNull();
    expect(parseBBox('  ')).toBeNull();
  });

  it.each([
    '1,2,3',
    '1,2,3,4,5',
    'a,60,25,61',
    '24,60,,61',
    '-181,60,25,61',
    '24,60,181,61',
    '24,-91,25,61',
    '24,60,25,91',
    '25,60,24,61',
    '24,61,25,60',
    '24,60,24,61',
    'NaN,60,25,61',
    'Infinity,60,25,61',
  ])('rejects %s', (value) => {
    expect(() => parseBBox(value)).toThrow(InvalidRequestError);
  });
});

describe('cursor', () => {
  it('uses the same encoding as the Java API', () => {
    expect(encodeCursor('FIQ-00042')).toBe('c2Vuc29yOkZJUS0wMDA0Mg==');
    expect(decodeCursor('c2Vuc29yOkZJUS0wMDA0Mg==')).toBe('FIQ-00042');
    expect(decodeCursor(null)).toBeNull();
    expect(() => decodeCursor('%%%')).toThrow(InvalidRequestError);
    expect(() => decodeCursor('Zm9vOmJhcg==')).toThrow(InvalidRequestError);
  });
});

describe('SensorStore', () => {
  it('serves all 4,000 sensors ordered by id', () => {
    expect(store.sensors).toHaveLength(4000);
    expect(store.sensors[0]?.id).toBe('FIQ-00001');
  });

  it('filters by bbox inclusively', () => {
    const box = { minLon: 24.7, minLat: 60.1, maxLon: 25.25, maxLat: 60.35 };
    const inBox = store.filter({ bbox: box });
    expect(inBox.length).toBeGreaterThan(300);
    expect(
      inBox.every((s) => s.lon >= 24.7 && s.lon <= 25.25 && s.lat >= 60.1 && s.lat <= 60.35),
    ).toBe(true);
  });

  it('filters by type, status, region and search', () => {
    const r = store.filter({ types: ['NOISE'], statuses: ['ALERT'], regions: ['Uusimaa'] });
    expect(
      r.every((s) => s.type === 'NOISE' && s.status === 'ALERT' && s.region === 'Uusimaa'),
    ).toBe(true);
    expect(store.filter({ search: 'fiq-00042' }).map((s) => s.id)).toEqual(['FIQ-00042']);
    expect(store.filter({ search: 'ROVANIEMI' }).length).toBeGreaterThanOrEqual(140);
  });

  it('paginates with cursors', () => {
    const ids: string[] = [];
    let after: string | null = null;
    let pages = 0;
    for (;;) {
      const page = store.page({ statuses: ['ALERT'] }, 100, after);
      ids.push(...page.items.map((s) => s.id));
      expect(page.totalCount).toBe(280);
      pages++;
      if (!page.hasNextPage) break;
      after = encodeCursor(page.items.at(-1)?.id ?? '');
    }
    expect(pages).toBe(3);
    expect(new Set(ids).size).toBe(280);
    expect(() => store.page({}, 0, null)).toThrow(InvalidRequestError);
    expect(() => store.page({}, 201, null)).toThrow(InvalidRequestError);
  });

  it('aggregates stats with every status, type and metric', () => {
    const stats = store.stats({});
    expect(stats.total).toBe(4000);
    expect(stats.byStatus).toEqual([
      { status: 'ONLINE', count: 3400 },
      { status: 'OFFLINE', count: 200 },
      { status: 'ALERT', count: 280 },
      { status: 'LOW_BATTERY', count: 120 },
    ]);
    expect(stats.byType.map((t) => t.type)).toEqual([
      'TEMPERATURE',
      'HUMIDITY',
      'NOISE',
      'AIR_QUALITY_PM25',
      'MULTI',
    ]);
    expect(stats.averages.map((a) => a.unit)).toEqual(['°C', '%', 'dB', 'µg/m³']);
    expect(stats.activeAlerts).toBe(600);
    expect(stats.regionsCovered).toBe(19);
  });

  it('returns null averages when nothing in scope measures a metric', () => {
    const stats = store.stats({ types: ['NOISE'] });
    expect(stats.averages.find((a) => a.metric === 'PM25')).toEqual({
      metric: 'PM25',
      average: null,
      unit: 'µg/m³',
      sampleSize: 0,
    });
  });

  it('lists regions in code-point order summing to 4,000', () => {
    const regions = store.regions();
    expect(regions).toHaveLength(19);
    expect(regions.map((r) => r.region)).toEqual([...regions.map((r) => r.region)].sort());
    expect(regions.reduce((n, r) => n + r.sensorCount, 0)).toBe(4000);
  });

  it('builds hourly readings, newest data up to now', () => {
    const s = store.requireSensor('FIQ-00001');
    const readings = store.readings(s);
    expect(readings).toHaveLength(24);
    expect(readings.at(-1)?.ts.toISOString()).toBe('2026-10-10T12:00:00.000Z');
    expect(() => store.readings(s, new Date(NOW), new Date(NOW - 1000))).toThrow(
      InvalidRequestError,
    );
    expect(() => store.readings(s, new Date(NOW - 40 * 86400_000), new Date(NOW))).toThrow(
      InvalidRequestError,
    );
    expect(() => store.requireSensor('FIQ-99999')).toThrow(NotFoundError);
  });

  it('stops offline history at the last report', () => {
    const offline = store.sensors.find(
      (s) => s.status === 'OFFLINE' && s.lastSeenSecondsAgo > 86400,
    );
    expect(offline).toBeDefined();
    if (offline) expect(store.readings(offline)).toEqual([]);
  });

  it('anchors relative times at now (second precision)', () => {
    const s = store.requireSensor('FIQ-00001');
    expect(store.lastSeenAt(s).getTime()).toBe(
      Math.floor(NOW / 1000) * 1000 - s.lastSeenSecondsAgo * 1000,
    );
    expect(store.latestReadings(s)[0]?.ts).toEqual(store.lastSeenAt(s));
  });

  it('lists alerts newest first and per sensor', () => {
    const active = store.alertList(true, 1000);
    expect(active).toHaveLength(600);
    expect(store.alertList(false, 1000)).toHaveLength(1000);
    expect(active[0]?.sensorName).toBeTruthy();
    expect(() => store.alertList(true, 0)).toThrow(InvalidRequestError);
    const sensorWithAlert = active[0]?.sensorId ?? '';
    expect(store.alertsFor(sensorWithAlert, true).length).toBeGreaterThan(0);
  });
});

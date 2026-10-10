import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadFinland, SENSORS_JSON } from '../scripts/lib/boundary.js';
import {
  allocate,
  DEFAULT_SEED,
  generateFixture,
  SENSOR_COUNT,
  serializeFixture,
  type Fixture,
} from '../scripts/lib/generator.js';
import { distanceKm, pointInPolygons } from '../scripts/lib/geo.js';
import { MUNICIPALITIES, POPULATION_CENTRES } from '../scripts/lib/municipalities.js';

const polygons = loadFinland();
const fixture = generateFixture({ seed: DEFAULT_SEED, total: SENSOR_COUNT, polygons });

describe('Finland boundary', () => {
  it.each([
    ['Tampere', 61.4978, 23.761],
    ['Rovaniemi', 66.5039, 25.7294],
    ['Inari', 68.9055, 27.028],
    ['Mariehamn (Åland)', 60.0973, 19.9348],
  ])('contains %s', (_name, lat, lon) => {
    expect(pointInPolygons(lon, lat, polygons)).toBe(true);
  });

  it.each([
    ['Stockholm', 59.3293, 18.0686],
    ['Tallinn', 59.437, 24.7536],
    ['Gulf of Bothnia', 63.0, 20.5],
    ['St Petersburg', 59.9343, 30.3351],
    ['Tromsø', 69.6492, 18.9553],
  ])('excludes %s', (_name, lat, lon) => {
    expect(pointInPolygons(lon, lat, polygons)).toBe(false);
  });
});

describe('generateFixture', () => {
  it('produces exactly 4,000 sensors with unique, sequential ids', () => {
    expect(fixture.sensors).toHaveLength(4000);
    expect(new Set(fixture.sensors.map((s) => s.id)).size).toBe(4000);
    expect(fixture.sensors[0]?.id).toBe('FIQ-00001');
    expect(fixture.sensors[3999]?.id).toBe('FIQ-04000');
  });

  it('places every sensor inside the Finland polygon (no points at sea or abroad)', () => {
    const outside = fixture.sensors.filter((s) => !pointInPolygons(s.lon, s.lat, polygons));
    expect(outside).toEqual([]);
  });

  it('is deterministic for a given seed', () => {
    const again = generateFixture({ seed: DEFAULT_SEED, total: SENSOR_COUNT, polygons });
    expect(serializeFixture(again)).toBe(serializeFixture(fixture));
    const other = generateFixture({ seed: DEFAULT_SEED + 1, total: SENSOR_COUNT, polygons });
    expect(other.sensors[0]).not.toEqual(fixture.sensors[0]);
  });

  it('matches the committed shared/fixtures/sensors.json', () => {
    expect(readFileSync(SENSORS_JSON, 'utf8')).toBe(serializeFixture(fixture));
  });

  it('uses the exact status mix (85 / 7 / 5 / 3 %)', () => {
    const count = (status: string) => fixture.sensors.filter((s) => s.status === status).length;
    expect(count('ONLINE')).toBe(3400);
    expect(count('ALERT')).toBe(280);
    expect(count('OFFLINE')).toBe(200);
    expect(count('LOW_BATTERY')).toBe(120);
  });

  it('is weighted towards the nine population centres', () => {
    const centres = MUNICIPALITIES.filter((m) => POPULATION_CENTRES.includes(m.name));
    const nearCentre = fixture.sensors.filter((s) =>
      centres.some((c) => distanceKm(s.lat, s.lon, c.lat, c.lon) < 30),
    );
    expect(nearCentre.length / fixture.sensors.length).toBeGreaterThan(0.5);
    const helsinki = fixture.sensors.filter((s) => s.municipality === 'Helsinki').length;
    expect(helsinki).toBeGreaterThanOrEqual(520);
  });

  it('spreads sparsely across Lapland', () => {
    const lapland = fixture.sensors.filter((s) => s.region === 'Lappi');
    const farNorth = fixture.sensors.filter((s) => s.lat > 68);
    expect(lapland.length).toBeGreaterThan(250);
    expect(lapland.length).toBeLessThan(700);
    expect(farNorth.length).toBeGreaterThan(10);
  });

  it('keeps sites, sensors and alerts referentially consistent', () => {
    const sites = new Map(fixture.sites.map((s) => [s.id, s]));
    for (const s of fixture.sensors) {
      const site = sites.get(s.siteId);
      expect(site?.name).toBe(s.siteName);
      expect(site?.municipality).toBe(s.municipality);
    }
    expect(fixture.sites.reduce((n, s) => n + s.sensorCount, 0)).toBe(4000);
    const ids = new Set(fixture.sensors.map((s) => s.id));
    expect(fixture.alerts.every((a) => ids.has(a.sensorId))).toBe(true);
    expect(fixture.counts).toEqual<Fixture['counts']>({
      sensors: 4000,
      sites: fixture.sites.length,
      alerts: fixture.alerts.length,
      activeAlerts: fixture.alerts.filter((a) => a.resolvedSecondsAgo === null).length,
    });
  });

  it('gives every non-online sensor an active alert and covers all regions', () => {
    const active = new Set(
      fixture.alerts.filter((a) => a.resolvedSecondsAgo === null).map((a) => a.sensorId),
    );
    expect(
      fixture.sensors.filter((s) => s.status !== 'ONLINE').every((s) => active.has(s.id)),
    ).toBe(true);
    expect(new Set(fixture.sensors.map((s) => s.region)).size).toBe(19);
  });

  it('keeps battery and timestamps within realistic ranges', () => {
    for (const s of fixture.sensors) {
      expect(s.batteryPct).toBeGreaterThanOrEqual(0);
      expect(s.batteryPct).toBeLessThanOrEqual(100);
      if (s.status === 'LOW_BATTERY') expect(s.batteryPct).toBeLessThan(15);
      if (s.status !== 'OFFLINE') expect(s.lastSeenSecondsAgo).toBeLessThanOrEqual(120);
      expect(Date.parse(s.installedAt)).not.toBeNaN();
    }
  });
});

describe('allocate', () => {
  it('distributes the exact total', () => {
    expect(allocate([1, 1, 1], 10)).toEqual([4, 3, 3]);
    expect(allocate([5, 3, 2], 7).reduce((a, b) => a + b, 0)).toBe(7);
  });
});

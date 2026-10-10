import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { loadFixture } from '../src/domain/model.js';
import { SensorStore } from '../src/domain/store.js';

const fixture = loadFixture();
const app = createApp(new SensorStore(fixture));
const HELSINKI = '24.70,60.10,25.25,60.35';

describe('REST /api/v1', () => {
  it('health reports mock mode', async () => {
    const res = await request(app).get('/api/v1/health').expect(200);
    expect(res.body).toMatchObject({ status: 'UP', mode: 'mock', version: '2.0.0' });
  });

  it('serves all sensors as GeoJSON with an ETag', async () => {
    const res = await request(app).get('/api/v1/sensors.geojson').expect(200);
    expect(res.headers['content-type']).toContain('application/geo+json');
    expect(res.headers['etag']).toBeTruthy();
    const body = JSON.parse(res.text);
    expect(body.type).toBe('FeatureCollection');
    expect(body.features).toHaveLength(4000);
    expect(body.features[0]).toMatchObject({
      type: 'Feature',
      id: 'FIQ-00001',
      geometry: { type: 'Point' },
    });
    expect(Object.keys(body.features[0].properties).sort()).toEqual(
      [
        'batteryPct',
        'id',
        'lastSeenAt',
        'metric',
        'municipality',
        'name',
        'pm25',
        'region',
        'siteName',
        'status',
        'type',
        'unit',
        'value',
      ].sort(),
    );
  });

  it('filters by bbox and lists', async () => {
    const res = await request(app)
      .get('/api/v1/sensors.geojson')
      .query({ bbox: HELSINKI, type: 'NOISE,MULTI', status: ['ALERT', 'ONLINE'] })
      .expect(200);
    const features = JSON.parse(res.text).features as {
      properties: { type: string; status: string };
    }[];
    expect(features.length).toBeGreaterThan(0);
    expect(features.every((f) => ['NOISE', 'MULTI'].includes(f.properties.type))).toBe(true);
  });

  it.each(['1,2,3', '-200,60,25,61', '25,60,24,61', 'x,y,z,w'])(
    'rejects bbox %s with problem+json',
    async (bbox) => {
      const res = await request(app).get('/api/v1/sensors.geojson').query({ bbox }).expect(400);
      expect(res.headers['content-type']).toContain('application/problem+json');
      expect(JSON.parse(res.text)).toMatchObject({
        type: 'https://fieldiq.dev/problems/invalid-request',
        title: 'Invalid request',
        status: 400,
        instance: '/api/v1/sensors.geojson',
      });
    },
  );

  it('rejects unknown enum values', async () => {
    await request(app).get('/api/v1/sensors.geojson').query({ status: 'BROKEN' }).expect(400);
  });

  it('returns sensor detail and 404 for unknown sensors', async () => {
    const res = await request(app).get('/api/v1/sensors/FIQ-00042').expect(200);
    expect(res.body.id).toBe('FIQ-00042');
    expect(res.body.latestReadings.length).toBeGreaterThan(0);
    expect(res.body.lastSeenAt).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/);
    const missing = await request(app).get('/api/v1/sensors/FIQ-99999').expect(404);
    expect(JSON.parse(missing.text).title).toBe('Not found');
  });

  it('returns readings and validates the range', async () => {
    const id = fixture.sensors.find((s) => s.type === 'MULTI' && s.status === 'ONLINE')?.id;
    const res = await request(app)
      .get(`/api/v1/sensors/${id}/readings`)
      .query({ metric: 'PM25' })
      .expect(200);
    expect(res.body).toHaveLength(24);
    expect(res.body.every((r: { metric: string }) => r.metric === 'PM25')).toBe(true);
    const now = new Date();
    await request(app)
      .get(`/api/v1/sensors/${id}/readings`)
      .query({ from: now.toISOString(), to: new Date(now.getTime() - 60_000).toISOString() })
      .expect(400);
    await request(app)
      .get(`/api/v1/sensors/${id}/readings`)
      .query({ from: 'yesterday' })
      .expect(400);
  });

  it('exports CSV with a download filename', async () => {
    const res = await request(app)
      .get('/api/v1/export/sensors.csv')
      .query({ bbox: HELSINKI })
      .expect(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toContain('fieldiq-sensors.csv');
    const lines = res.text.split('\r\n').filter(Boolean);
    expect(lines[0]).toBe(
      'id,name,type,status,lat,lon,municipality,region,site,battery_pct,firmware,last_seen_at,metric,value,unit',
    );
    expect(lines.length).toBeGreaterThan(300);
  });

  it('answers unknown routes with problem+json', async () => {
    const res = await request(app).get('/api/v1/nope').expect(404);
    expect(res.headers['content-type']).toContain('application/problem+json');
  });
});

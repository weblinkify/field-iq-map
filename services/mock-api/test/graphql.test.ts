import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const app = createApp();

async function gql(query: string, variables: Record<string, unknown> = {}) {
  const res = await request(app).post('/graphql').send({ query, variables }).expect(200);
  return res.body as {
    data?: Record<string, unknown>;
    errors?: { message: string; extensions?: Record<string, unknown> }[];
  };
}

describe('GraphQL /graphql', () => {
  it('resolves a sensor with nested fields', async () => {
    const { data, errors } = await gql(
      `query($id: ID!) { sensor(id: $id) {
          id name status lastSeenAt installedAt location { lat lon }
          site { id name sensorCount location { lat } }
          latestReadings { metric value unit ts }
          readings { ts metric value }
          alerts { id severity createdAt resolvedAt sensorName }
      } }`,
      { id: 'FIQ-00042' },
    );
    expect(errors).toBeUndefined();
    const sensor = data?.['sensor'] as Record<string, unknown>;
    expect(sensor['id']).toBe('FIQ-00042');
    expect(sensor['lastSeenAt']).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/);
    expect((sensor['site'] as { sensorCount: number }).sensorCount).toBeGreaterThan(0);
  });

  it('returns null for unknown sensors', async () => {
    const { data, errors } = await gql('{ sensor(id: "FIQ-99999") { id } }');
    expect(errors).toBeUndefined();
    expect(data?.['sensor']).toBeNull();
  });

  it('paginates with cursors', async () => {
    const { data } = await gql(
      '{ sensors(first: 2, filter: { statuses: [ALERT] }) { totalCount edges { cursor node { id } } pageInfo { hasNextPage endCursor } } }',
    );
    const conn = data?.['sensors'] as {
      totalCount: number;
      pageInfo: { hasNextPage: boolean; endCursor: string };
    };
    expect(conn.totalCount).toBe(280);
    expect(conn.pageInfo.hasNextPage).toBe(true);
    const next = await gql(
      'query($after: String) { sensors(first: 2, after: $after) { edges { node { id } } } }',
      {
        after: conn.pageInfo.endCursor,
      },
    );
    expect(next.errors).toBeUndefined();
  });

  it('classifies invalid input as BAD_REQUEST like Spring for GraphQL', async () => {
    for (const query of [
      '{ sensors(first: 500) { totalCount } }',
      '{ sensors(after: "bogus") { totalCount } }',
      '{ sensorStats(bbox: {minLon: 30, minLat: 60, maxLon: 20, maxLat: 61}) { total } }',
      '{ alerts(first: 0) { id } }',
    ]) {
      const { errors } = await gql(query);
      expect(errors?.[0]?.extensions?.['classification'], query).toBe('BAD_REQUEST');
    }
  });

  it('computes stats, regions, sites and alerts', async () => {
    const { data } = await gql(`{
      sensorStats { total activeAlerts regionsCovered byStatus { status count } averages { metric average unit sampleSize } }
      regions { region sensorCount }
      sites { id }
      alerts(first: 1000) { id }
    }`);
    expect((data?.['sensorStats'] as { total: number }).total).toBe(4000);
    expect(data?.['regions']).toHaveLength(19);
    expect(data?.['sites']).toHaveLength(264);
    expect(data?.['alerts']).toHaveLength(600);
  });

  it('redirects /graphiql to the GraphiQL IDE', async () => {
    await request(app).get('/graphiql').expect(302).expect('location', '/graphql');
  });
});

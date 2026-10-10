import { readFileSync } from 'node:fs';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { GraphQLError, GraphQLScalarType, Kind } from 'graphql';
import { createYoga, type YogaServerInstance } from 'graphql-yoga';
import type { BBoxInput, Resolvers, SensorFilter } from './generated/graphql.js';
import { isoSeconds, SHARED_DIR } from './domain/model.js';
import {
  encodeCursor,
  InvalidRequestError,
  NotFoundError,
  validateBBox,
  type Criteria,
  type SensorStore,
} from './domain/store.js';

export interface Context {
  store: SensorStore;
}

const typeDefs = readFileSync(`${SHARED_DIR}/graphql/schema.graphqls`, 'utf8');

function parseDateTime(value: unknown): Date {
  const date = typeof value === 'string' ? new Date(value) : new Date(NaN);
  if (Number.isNaN(date.getTime())) throw new GraphQLError(`Invalid DateTime: ${String(value)}`);
  return date;
}

const DateTime = new GraphQLScalarType<Date, string>({
  name: 'DateTime',
  serialize: (value) => {
    if (value instanceof Date) return isoSeconds(value);
    throw new GraphQLError(`Expected a Date but got ${String(value)}`);
  },
  parseValue: parseDateTime,
  parseLiteral: (ast) =>
    ast.kind === Kind.STRING ? parseDateTime(ast.value) : parseDateTime(null),
});

/** Maps domain errors to the same classifications Spring for GraphQL uses. */
function guard<T>(fn: () => T): T {
  try {
    return fn();
  } catch (e) {
    if (e instanceof InvalidRequestError)
      throw new GraphQLError(e.message, { extensions: { classification: 'BAD_REQUEST' } });
    if (e instanceof NotFoundError)
      throw new GraphQLError(e.message, { extensions: { classification: 'NOT_FOUND' } });
    throw e;
  }
}

const criteria = (filter?: SensorFilter | null, bbox?: BBoxInput | null): Criteria => ({
  bbox: bbox ? validateBBox(bbox) : null,
  types: filter?.types,
  statuses: filter?.statuses,
  regions: filter?.regions,
  search: filter?.search,
});

export const resolvers: Resolvers<Context> = {
  DateTime,
  Query: {
    sensor: (_, { id }, { store }) => store.sensor(id) ?? null,
    sensors: (_, { filter, bbox, first, after }, { store }) =>
      guard(() => {
        const page = store.page(criteria(filter, bbox), first, after);
        const edges = page.items.map((node) => ({ cursor: encodeCursor(node.id), node }));
        return {
          edges,
          pageInfo: { hasNextPage: page.hasNextPage, endCursor: edges.at(-1)?.cursor ?? null },
          totalCount: page.totalCount,
        };
      }),
    sensorStats: (_, { bbox, filter }, { store }) =>
      guard(() => store.stats(criteria(filter, bbox))),
    regions: (_, __, { store }) => store.regions(),
    sites: (_, { region }, { store }) => store.sitesIn(region),
    alerts: (_, { activeOnly, first }, { store }) =>
      guard(() => store.alertList(activeOnly ?? true, first ?? 100)),
  },
  Sensor: {
    location: (s) => ({ lat: s.lat, lon: s.lon }),
    installedAt: (s) => new Date(s.installedAt),
    lastSeenAt: (s, _, { store }) => store.lastSeenAt(s),
    site: (s, _, { store }) => {
      const site = store.site(s.siteId);
      if (!site) throw new GraphQLError(`Site ${s.siteId} missing`);
      return site;
    },
    latestReadings: (s, _, { store }) => store.latestReadings(s),
    readings: (s, { from, to, metric }, { store }) =>
      guard(() => store.readings(s, from, to, metric)),
    alerts: (s, { activeOnly }, { store }) => store.alertsFor(s.id, activeOnly ?? false),
  },
  Site: {
    location: (s) => ({ lat: s.lat, lon: s.lon }),
  },
  Alert: {
    createdAt: (a, _, { store }) => store.ago(a.createdSecondsAgo),
    resolvedAt: (a, _, { store }) =>
      a.resolvedSecondsAgo === null ? null : store.ago(a.resolvedSecondsAgo),
  },
};

const classification = (e: unknown): unknown =>
  typeof e === 'object' && e !== null && 'extensions' in e
    ? (e as { extensions?: Record<string, unknown> }).extensions?.['classification']
    : undefined;

/**
 * Keeps classified client errors (and GraphQL validation errors) visible; masks the rest.
 * Duck-typed so it works even when graphql is loaded twice (e.g. under Vitest).
 */
function maskError(error: unknown, message: string): Error {
  const original =
    typeof error === 'object' && error !== null && 'originalError' in error
      ? (error as { originalError?: unknown }).originalError
      : undefined;
  if (classification(error) || classification(original)) return error as Error;
  if (original === undefined || original === null) return error as Error;
  return new GraphQLError(message, { extensions: { classification: 'INTERNAL_ERROR' } });
}

export function createGraphQl(
  store: SensorStore,
): YogaServerInstance<Record<string, unknown>, Context> {
  return createYoga<Record<string, unknown>, Context>({
    schema: makeExecutableSchema<Context>({ typeDefs, resolvers }),
    context: () => ({ store }),
    graphqlEndpoint: '/graphql',
    graphiql: { title: 'FieldIQ GraphiQL (mock)' },
    maskedErrors: { maskError },
    landingPage: false,
    logging: 'warn',
  });
}

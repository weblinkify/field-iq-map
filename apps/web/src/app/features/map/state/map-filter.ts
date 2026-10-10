import type { SensorStatus, SensorType } from '../../../api/generated/graphql';

export interface MapFilter {
  types: readonly SensorType[];
  statuses: readonly SensorStatus[];
  regions: readonly string[];
}

export const EMPTY_FILTER: MapFilter = { types: [], statuses: [], regions: [] };

/** A GL style filter expression (MapLibre and Mapbox share the syntax). */
export type FilterExpression = readonly unknown[];

export interface FilterableProps {
  type: string;
  status: string;
  region: string;
}

export const isEmptyFilter = (f: MapFilter): boolean =>
  f.types.length === 0 && f.statuses.length === 0 && f.regions.length === 0;

/**
 * GL expression equivalent of {@link matchesFilter}. Used on unclustered layers so filtering is a
 * pure render-time operation — no refetch.
 */
export function buildFilterExpression(f: MapFilter): FilterExpression | null {
  const clauses: unknown[] = [];
  if (f.types.length) clauses.push(['in', ['get', 'type'], ['literal', [...f.types]]]);
  if (f.statuses.length) clauses.push(['in', ['get', 'status'], ['literal', [...f.statuses]]]);
  if (f.regions.length) clauses.push(['in', ['get', 'region'], ['literal', [...f.regions]]]);
  return clauses.length ? ['all', ...clauses] : null;
}

/** Combines a layer's base filter with the user's filter. */
export function withBaseFilter(
  base: FilterExpression | null,
  user: FilterExpression | null,
): FilterExpression | null {
  if (base && user) return ['all', base, user];
  return base ?? user;
}

/**
 * Same semantics as {@link buildFilterExpression}, evaluated in JS. Clustered sources cannot be
 * filtered by a layer expression, so their data is re-filtered in memory with this predicate.
 */
export function matchesFilter(props: FilterableProps, f: MapFilter): boolean {
  return (
    (f.types.length === 0 || (f.types as readonly string[]).includes(props.type)) &&
    (f.statuses.length === 0 || (f.statuses as readonly string[]).includes(props.status)) &&
    (f.regions.length === 0 || f.regions.includes(props.region))
  );
}

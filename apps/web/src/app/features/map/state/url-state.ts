import type { ParamMap, Params } from '@angular/router';
import type { SensorStatus, SensorType } from '../../../api/generated/graphql';
import type { BBox } from '../../../api/rest/sensors-rest.service';
import { SENSOR_STATUSES, SENSOR_TYPES } from '../../../core/sensor-meta';
import type { MapFilter } from './map-filter';

export type LayerMode = 'clusters' | 'points' | 'heatmap';
export const LAYER_MODES: readonly LayerMode[] = ['clusters', 'points', 'heatmap'];

/** Everything about the map view that is shareable through the URL. */
export interface MapUrlState {
  sensor: string | null;
  bbox: BBox | null;
  filter: MapFilter;
  layer: LayerMode;
}

const round = (n: number) => Math.round(n * 1e5) / 1e5;

export function serializeBBox(b: BBox): string {
  return [b.minLon, b.minLat, b.maxLon, b.maxLat].map(round).join(',');
}

/** Parses "minLon,minLat,maxLon,maxLat"; null for anything invalid (same rules as the API). */
export function parseBBox(value: string | null | undefined): BBox | null {
  if (!value) return null;
  const parts = value.split(',');
  if (parts.length !== 4 || parts.some((p) => p.trim() === '')) return null;
  const [minLon, minLat, maxLon, maxLat] = parts.map(Number) as [number, number, number, number];
  if (![minLon, minLat, maxLon, maxLat].every(Number.isFinite)) return null;
  if (minLon < -180 || maxLon > 180 || minLat < -90 || maxLat > 90) return null;
  if (minLon >= maxLon || minLat >= maxLat) return null;
  return { minLon, minLat, maxLon, maxLat };
}

/** Normalises a bbox drawn in any direction. */
export function normalizeBBox(a: [number, number], b: [number, number]): BBox {
  return {
    minLon: Math.min(a[0], b[0]),
    minLat: Math.min(a[1], b[1]),
    maxLon: Math.max(a[0], b[0]),
    maxLat: Math.max(a[1], b[1]),
  };
}

function csv<T extends string>(value: string | null, allowed?: readonly T[]): T[] {
  if (!value) return [];
  const items = value
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
  return (allowed ? items.filter((v) => (allowed as readonly string[]).includes(v)) : items) as T[];
}

const SENSOR_ID = /^FIQ-\d{5}$/;

export function parseUrlState(params: ParamMap): MapUrlState {
  const sensor = params.get('sensor');
  const layer = params.get('layer') as LayerMode | null;
  return {
    sensor: sensor && SENSOR_ID.test(sensor) ? sensor : null,
    bbox: parseBBox(params.get('bbox')),
    filter: {
      types: csv<SensorType>(params.get('types'), SENSOR_TYPES),
      statuses: csv<SensorStatus>(params.get('statuses'), SENSOR_STATUSES),
      regions: csv<string>(params.get('regions')),
    },
    layer: layer && LAYER_MODES.includes(layer) ? layer : 'clusters',
  };
}

/** Query params for router.navigate; null removes a key (merge mode). */
export function toQueryParams(state: MapUrlState): Params {
  return {
    sensor: state.sensor,
    bbox: state.bbox ? serializeBBox(state.bbox) : null,
    types: state.filter.types.length ? state.filter.types.join(',') : null,
    statuses: state.filter.statuses.length ? state.filter.statuses.join(',') : null,
    regions: state.filter.regions.length ? state.filter.regions.join(',') : null,
    layer: state.layer === 'clusters' ? null : state.layer,
  };
}

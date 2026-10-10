import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { polygonsOf, type BoundaryCollection, type Polygon } from './geo.js';

export const SHARED_DIR = fileURLToPath(new URL('../../', import.meta.url));
export const FINLAND_GEOJSON = `${SHARED_DIR}geo/finland.geojson`;
export const SENSORS_JSON = `${SHARED_DIR}fixtures/sensors.json`;

export function loadFinland(): Polygon[] {
  return polygonsOf(JSON.parse(readFileSync(FINLAND_GEOJSON, 'utf8')) as BoundaryCollection);
}

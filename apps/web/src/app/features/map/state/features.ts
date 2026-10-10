import type {
  SensorFeatureCollection,
  SensorFeatureProperties,
} from '../../../api/rest/sensors-rest.service';
import { TYPE_GLYPHS } from '../../../core/sensor-meta';

/** Feature as fed to the GL source: numeric id (needed for feature-state) + glyph. */
export interface MapFeature {
  type: 'Feature';
  id: number;
  geometry: { type: 'Point'; coordinates: [number, number] };
  properties: SensorFeatureProperties & { glyph: string };
}

export interface MapFeatureCollection {
  type: 'FeatureCollection';
  features: MapFeature[];
}

/** FIQ-00042 → 42. */
export const numericId = (sensorId: string): number => Number(sensorId.replace(/\D/g, ''));

export function toMapFeatures(fc: SensorFeatureCollection): MapFeatureCollection {
  return {
    type: 'FeatureCollection',
    features: fc.features.map((f) => ({
      type: 'Feature',
      id: numericId(f.id),
      geometry: {
        type: 'Point',
        coordinates: [f.geometry.coordinates[0] ?? 0, f.geometry.coordinates[1] ?? 0],
      },
      properties: { ...f.properties, glyph: TYPE_GLYPHS[f.properties.type] },
    })),
  };
}

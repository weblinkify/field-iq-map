export type Position = readonly [number, number];
export type Ring = readonly Position[];
export type Polygon = readonly Ring[];

export interface BoundaryCollection {
  features: readonly {
    geometry:
      | { type: 'Polygon'; coordinates: Polygon }
      | { type: 'MultiPolygon'; coordinates: readonly Polygon[] };
  }[];
}

/** Flattens a FeatureCollection of (Multi)Polygons into a list of polygons. */
export function polygonsOf(collection: BoundaryCollection): Polygon[] {
  return collection.features.flatMap((f) =>
    f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : [...f.geometry.coordinates],
  );
}

/** Ray-casting test for a single ring. */
export function pointInRing(lon: number, lat: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i] as Position;
    const [xj, yj] = ring[j] as Position;
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** True when the point is inside the outer ring and outside every hole of any polygon. */
export function pointInPolygons(lon: number, lat: number, polygons: readonly Polygon[]): boolean {
  return polygons.some(
    ([outer, ...holes]) =>
      outer !== undefined &&
      pointInRing(lon, lat, outer) &&
      !holes.some((h) => pointInRing(lon, lat, h)),
  );
}

export interface BBox {
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
}

export function bboxOf(polygons: readonly Polygon[]): BBox {
  const box = { minLon: Infinity, minLat: Infinity, maxLon: -Infinity, maxLat: -Infinity };
  for (const poly of polygons)
    for (const ring of poly)
      for (const [lon, lat] of ring) {
        box.minLon = Math.min(box.minLon, lon);
        box.minLat = Math.min(box.minLat, lat);
        box.maxLon = Math.max(box.maxLon, lon);
        box.maxLat = Math.max(box.maxLat, lat);
      }
  return box;
}

/** Approximate distance in km (equirectangular; fine at Finland's scale). */
export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const x = (((lon2 - lon1) * Math.PI) / 180) * Math.cos((((lat1 + lat2) / 2) * Math.PI) / 180);
  const y = ((lat2 - lat1) * Math.PI) / 180;
  return Math.sqrt(x * x + y * y) * 6371;
}

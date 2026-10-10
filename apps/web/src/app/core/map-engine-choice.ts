export type MapEngineKind = 'mapbox' | 'maplibre';

export const ENGINE_LABELS: Record<MapEngineKind, string> = {
  mapbox: 'Mapbox GL',
  maplibre: 'MapLibre GL',
};

/**
 * Mapbox GL JS when a public token (pk.*) is configured, otherwise MapLibre GL JS with a free
 * basemap. Secret tokens (sk.*) must never reach a browser, so they are ignored.
 */
export function selectMapEngine(mapboxToken: string | null): MapEngineKind {
  return mapboxToken !== null && mapboxToken.startsWith('pk.') ? 'mapbox' : 'maplibre';
}

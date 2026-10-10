import type { Basemap } from '../../../core/runtime-config';

/** Finland (incl. Åland) extent from shared/geo/finland.geojson. */
export const FINLAND_BOUNDS: [[number, number], [number, number]] = [
  [19.51, 59.81],
  [31.54, 70.07],
];

/** Glyphs served by this app (public/fonts) for the offline style. */
export const LOCAL_FONT_STACK = ['Open Sans Semibold'] as const;
/** Glyphs available on the OpenFreeMap font server. */
export const OPENFREEMAP_FONT_STACK = ['Noto Sans Bold'] as const;
export const MAPBOX_FONT_STACK = ['DIN Pro Medium', 'Arial Unicode MS Regular'] as const;

/**
 * MapLibre basemap without any API key:
 * - "openfreemap": OpenFreeMap vector styles (dark / positron), OpenStreetMap data.
 * - "offline": a plain background with local glyphs — the Finland outline layer still gives
 *   context and no network is needed (used in CI and air-gapped demos).
 */
export function maplibreStyle(
  dark: boolean,
  basemap: Basemap,
  origin: string,
): string | Record<string, unknown> {
  if (basemap === 'openfreemap') {
    return `https://tiles.openfreemap.org/styles/${dark ? 'dark' : 'positron'}`;
  }
  return {
    version: 8,
    name: `FieldIQ offline ${dark ? 'dark' : 'light'}`,
    glyphs: `${origin}/fonts/{fontstack}/{range}.pbf`,
    sources: {},
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: { 'background-color': dark ? '#0b1220' : '#e8edf3' },
      },
    ],
  };
}

export const mapboxStyleUrl = (dark: boolean): string =>
  dark ? 'mapbox://styles/mapbox/dark-v11' : 'mapbox://styles/mapbox/light-v11';

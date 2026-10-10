import { SENSOR_STATUSES, STATUS_COLORS } from '../../../core/sensor-meta';
import type { BBox } from '../../../api/rest/sensors-rest.service';
import type { FilterExpression } from '../state/map-filter';
import { CLUSTER_STATUS_KEYS } from '../state/tooltip';
import type { LayerMode } from '../state/url-state';
import type { GlMap, LayerSpec } from './gl-map';

export const SOURCES = {
  finland: 'finland',
  /** Clustered sensors (data re-filtered in memory when filters change). */
  clustered: 'sensors',
  /** Unclustered sensors: individual points mode and the PM2.5 heatmap. */
  flat: 'sensors-flat',
  bbox: 'bbox',
} as const;

export const LAYERS = {
  finlandFill: 'finland-fill',
  finlandLine: 'finland-outline',
  clusters: 'clusters',
  clusterCount: 'cluster-count',
  points: 'sensor-points',
  glyphs: 'sensor-glyphs',
  flatPoints: 'sensor-points-flat',
  flatGlyphs: 'sensor-glyphs-flat',
  heat: 'pm25-heat',
  bboxFill: 'bbox-fill',
  bboxLine: 'bbox-line',
  bboxCorners: 'bbox-corners',
} as const;

/** Layers whose features are individual sensors (hover/click targets) per mode. */
export const SENSOR_LAYERS: Record<LayerMode, readonly string[]> = {
  clusters: [LAYERS.points],
  points: [LAYERS.flatPoints],
  heatmap: [LAYERS.flatPoints],
};

export const SENSOR_SOURCE: Record<LayerMode, string> = {
  clusters: SOURCES.clustered,
  points: SOURCES.flat,
  heatmap: SOURCES.flat,
};

export const UNCLUSTERED: FilterExpression = ['!', ['has', 'point_count']];

/** Layers that take the user's filter as a layer expression (flat source). */
export const EXPRESSION_FILTERED_LAYERS: readonly string[] = [
  LAYERS.flatPoints,
  LAYERS.flatGlyphs,
  LAYERS.heat,
];

const statusColor: unknown[] = [
  'match',
  ['get', 'status'],
  ...SENSOR_STATUSES.flatMap((s) => [s, STATUS_COLORS[s]]),
  '#94a3b8',
];

const hovered = ['boolean', ['feature-state', 'hover'], false];
/** Zoom-based radius (zoom → px); a zoom interpolation must be the outermost expression. */
const RADIUS_STOPS: readonly [number, number][] = [
  [4, 3],
  [8, 5],
  [12, 8],
  [16, 11],
];
const pointRadius: unknown[] = [
  'interpolate',
  ['linear'],
  ['zoom'],
  ...RADIUS_STOPS.flatMap(([zoom, px]) => [zoom, ['case', hovered, px + 4, px]]),
];

const pointPaint = {
  'circle-color': statusColor,
  'circle-radius': pointRadius,
  'circle-stroke-color': ['case', hovered, '#ffffff', '#0b0f1a'],
  'circle-stroke-width': ['case', hovered, 3, 1],
  'circle-opacity': 0.95,
};

const glyphLayout = (fontStack: readonly string[]) => ({
  'text-field': ['get', 'glyph'],
  'text-font': [...fontStack],
  'text-size': 10,
  'text-allow-overlap': true,
  'text-ignore-placement': true,
});

/** Cluster aggregates used by the cluster tooltip (status breakdown). */
export const CLUSTER_PROPERTIES = Object.fromEntries(
  SENSOR_STATUSES.map((s) => [
    CLUSTER_STATUS_KEYS[s],
    ['+', ['case', ['==', ['get', 'status'], s], 1, 0]],
  ]),
);

const EMPTY = { type: 'FeatureCollection', features: [] };

export function fieldIqLayers(fontStack: readonly string[]): LayerSpec[] {
  return [
    {
      id: LAYERS.finlandFill,
      type: 'fill',
      source: SOURCES.finland,
      paint: { 'fill-color': '#6366f1', 'fill-opacity': 0.05 },
    },
    {
      id: LAYERS.finlandLine,
      type: 'line',
      source: SOURCES.finland,
      paint: { 'line-color': '#818cf8', 'line-width': 1.5, 'line-opacity': 0.8 },
    },
    {
      id: LAYERS.heat,
      type: 'heatmap',
      source: SOURCES.flat,
      maxzoom: 15,
      layout: { visibility: 'none' },
      paint: {
        'heatmap-weight': [
          'interpolate',
          ['linear'],
          ['coalesce', ['get', 'pm25'], 0],
          0,
          0,
          10,
          0.3,
          35,
          1,
        ],
        'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 4, 0.8, 12, 2.5],
        'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 4, 12, 9, 22, 13, 40],
        'heatmap-opacity': 0.85,
        'heatmap-color': [
          'interpolate',
          ['linear'],
          ['heatmap-density'],
          0,
          'rgba(99,102,241,0)',
          0.2,
          '#6366f1',
          0.45,
          '#22c55e',
          0.7,
          '#f59e0b',
          1,
          '#ef4444',
        ],
      },
    },
    {
      id: LAYERS.clusters,
      type: 'circle',
      source: SOURCES.clustered,
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': [
          'step',
          ['get', 'point_count'],
          '#818cf8',
          25,
          '#6366f1',
          100,
          '#4f46e5',
          400,
          '#4338ca',
        ],
        'circle-radius': ['step', ['get', 'point_count'], 14, 25, 18, 100, 24, 400, 32],
        'circle-stroke-color': ['case', hovered, '#ffffff', 'rgba(129,140,248,0.35)'],
        'circle-stroke-width': ['case', hovered, 4, 6],
      },
    },
    {
      id: LAYERS.clusterCount,
      type: 'symbol',
      source: SOURCES.clustered,
      filter: ['has', 'point_count'],
      layout: {
        'text-field': ['get', 'point_count_abbreviated'],
        'text-font': [...fontStack],
        'text-size': 12,
        'text-allow-overlap': true,
      },
      paint: { 'text-color': '#ffffff' },
    },
    {
      id: LAYERS.points,
      type: 'circle',
      source: SOURCES.clustered,
      filter: UNCLUSTERED,
      paint: pointPaint,
    },
    {
      id: LAYERS.glyphs,
      type: 'symbol',
      source: SOURCES.clustered,
      filter: UNCLUSTERED,
      minzoom: 10,
      layout: glyphLayout(fontStack),
      paint: { 'text-color': '#0b0f1a' },
    },
    {
      id: LAYERS.flatPoints,
      type: 'circle',
      source: SOURCES.flat,
      layout: { visibility: 'none' },
      paint: pointPaint,
    },
    {
      id: LAYERS.flatGlyphs,
      type: 'symbol',
      source: SOURCES.flat,
      minzoom: 10,
      layout: { ...glyphLayout(fontStack), visibility: 'none' },
      paint: { 'text-color': '#0b0f1a' },
    },
    {
      id: LAYERS.bboxFill,
      type: 'fill',
      source: SOURCES.bbox,
      filter: ['==', ['geometry-type'], 'Polygon'],
      paint: { 'fill-color': '#818cf8', 'fill-opacity': 0.12 },
    },
    {
      id: LAYERS.bboxLine,
      type: 'line',
      source: SOURCES.bbox,
      filter: ['==', ['geometry-type'], 'Polygon'],
      paint: { 'line-color': '#a5b4fc', 'line-width': 2, 'line-dasharray': [2, 1] },
    },
    {
      id: LAYERS.bboxCorners,
      type: 'circle',
      source: SOURCES.bbox,
      filter: ['==', ['geometry-type'], 'Point'],
      paint: {
        'circle-radius': 7,
        'circle-color': '#ffffff',
        'circle-stroke-color': '#6366f1',
        'circle-stroke-width': 3,
      },
    },
  ];
}

/** Adds all FieldIQ sources and layers (call again after a basemap/style switch). */
export function addFieldIqLayers(
  map: GlMap,
  fontStack: readonly string[],
  finlandUrl: string,
): void {
  map.addSource(SOURCES.finland, { type: 'geojson', data: finlandUrl });
  map.addSource(SOURCES.clustered, {
    type: 'geojson',
    data: EMPTY,
    cluster: true,
    clusterRadius: 50,
    clusterMaxZoom: 11,
    clusterProperties: CLUSTER_PROPERTIES,
  });
  map.addSource(SOURCES.flat, { type: 'geojson', data: EMPTY });
  map.addSource(SOURCES.bbox, { type: 'geojson', data: EMPTY });
  for (const layer of fieldIqLayers(fontStack)) map.addLayer(layer);
}

/** Visibility of each mode-dependent layer. */
export function layerVisibility(mode: LayerMode): Record<string, 'visible' | 'none'> {
  const on = (v: boolean) => (v ? 'visible' : 'none');
  return {
    [LAYERS.clusters]: on(mode === 'clusters'),
    [LAYERS.clusterCount]: on(mode === 'clusters'),
    [LAYERS.points]: on(mode === 'clusters'),
    [LAYERS.glyphs]: on(mode === 'clusters'),
    [LAYERS.flatPoints]: on(mode !== 'clusters'),
    [LAYERS.flatGlyphs]: on(mode === 'points'),
    [LAYERS.heat]: on(mode === 'heatmap'),
  };
}

export function applyLayerMode(map: GlMap, mode: LayerMode): void {
  for (const [id, visibility] of Object.entries(layerVisibility(mode))) {
    map.setLayoutProperty(id, 'visibility', visibility);
  }
}

/** Selection rectangle polygon plus its four draggable corners. */
export function bboxFeatures(b: BBox | null): Record<string, unknown> {
  if (!b) return EMPTY;
  const corners: [string, [number, number]][] = [
    ['sw', [b.minLon, b.minLat]],
    ['se', [b.maxLon, b.minLat]],
    ['ne', [b.maxLon, b.maxLat]],
    ['nw', [b.minLon, b.maxLat]],
  ];
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { kind: 'area' },
        geometry: {
          type: 'Polygon',
          coordinates: [[...corners.map(([, c]) => c), [b.minLon, b.minLat]]],
        },
      },
      ...corners.map(([corner, c]) => ({
        type: 'Feature',
        properties: { kind: 'corner', corner },
        geometry: { type: 'Point', coordinates: c },
      })),
    ],
  };
}

import {
  bboxFeatures,
  CLUSTER_PROPERTIES,
  fieldIqLayers,
  LAYERS,
  layerVisibility,
  SOURCES,
} from './layers';

describe('FieldIQ layers', () => {
  const layers = fieldIqLayers(['Open Sans Semibold']);
  const byId = new Map(layers.map((l) => [l.id, l]));

  it('renders all points with GL layers only (no DOM markers)', () => {
    expect(
      layers.every((l) => ['fill', 'line', 'circle', 'symbol', 'heatmap'].includes(l.type)),
    ).toBe(true);
    expect(byId.get(LAYERS.points)?.source).toBe(SOURCES.clustered);
    expect(byId.get(LAYERS.points)?.['filter']).toEqual(['!', ['has', 'point_count']]);
    expect(byId.get(LAYERS.clusters)?.['filter']).toEqual(['has', 'point_count']);
  });

  it('colours points by status', () => {
    const paint = byId.get(LAYERS.points)?.['paint'] as Record<string, unknown>;
    expect(JSON.stringify(paint['circle-color'])).toContain('"ALERT","#ef4444"');
    expect(JSON.stringify(paint['circle-radius'])).toContain('feature-state');
  });

  it('aggregates a status breakdown per cluster', () => {
    expect(Object.keys(CLUSTER_PROPERTIES).sort()).toEqual([
      'alert',
      'lowBattery',
      'offline',
      'online',
    ]);
  });

  it('toggles layer visibility per mode', () => {
    expect(layerVisibility('clusters')[LAYERS.clusters]).toBe('visible');
    expect(layerVisibility('clusters')[LAYERS.heat]).toBe('none');
    expect(layerVisibility('points')[LAYERS.flatPoints]).toBe('visible');
    expect(layerVisibility('points')[LAYERS.clusters]).toBe('none');
    expect(layerVisibility('heatmap')[LAYERS.heat]).toBe('visible');
    expect(layerVisibility('heatmap')[LAYERS.flatGlyphs]).toBe('none');
  });

  it('fades points in at high zoom in heatmap mode only', () => {
    expect(flatPointOpacity('points')).toBe(0.95);
    expect(JSON.stringify(flatPointOpacity('heatmap'))).toContain('zoom');
  });

  it('builds a selection polygon with four corners', () => {
    const fc = bboxFeatures({ minLon: 24, minLat: 60, maxLon: 25, maxLat: 61 }) as {
      features: { geometry: { type: string }; properties: { corner?: string } }[];
    };
    expect(fc.features.map((f) => f.geometry.type)).toEqual([
      'Polygon',
      'Point',
      'Point',
      'Point',
      'Point',
    ]);
    expect(fc.features.slice(1).map((f) => f.properties.corner)).toEqual(['sw', 'se', 'ne', 'nw']);
    expect((bboxFeatures(null) as { features: unknown[] }).features).toEqual([]);
  });
});

import type { GlMap, MapEngine, MapPointerEvent, RenderedFeature } from './engine/gl-map';
import { LAYERS, SOURCES } from './engine/layers';
import { MapController, type MapCallbacks } from './map-controller';
import type { MapFeatureCollection } from './state/features';

type Handler = (e: MapPointerEvent) => void;

/** Minimal in-memory stand-in for a Mapbox/MapLibre map. */
class FakeMap {
  readonly handlers = new Map<string, Handler[]>();
  readonly featureState = new Map<string, Record<string, boolean>>();
  readonly data = new Map<string, unknown>();
  readonly layout = new Map<string, unknown>();
  readonly filters = new Map<string, unknown>();
  rendered: RenderedFeature[] = [];
  dragPanEnabled = true;
  canvas = document.createElement('canvas');
  eased: Record<string, unknown> | null = null;

  addSource(id: string): void {
    this.data.set(id, null);
  }
  getSource(id: string) {
    return {
      setData: (d: unknown) => this.data.set(id, d),
      getClusterExpansionZoom: () => Promise.resolve(8),
    };
  }
  addLayer(): void {}
  getLayer(): unknown {
    return {};
  }
  setLayoutProperty(layer: string, _name: string, value: unknown): void {
    this.layout.set(layer, value);
  }
  setPaintProperty(): void {}
  setFilter(layer: string, f: unknown): void {
    this.filters.set(layer, f);
  }
  setFeatureState(f: { source: string; id: number }, state: Record<string, boolean>): void {
    this.featureState.set(`${f.source}:${f.id}`, state);
  }
  queryRenderedFeatures(): RenderedFeature[] {
    return this.rendered;
  }
  project([lng, lat]: [number, number]) {
    return { x: lng * 10, y: (90 - lat) * 10 };
  }
  unproject([x, y]: [number, number]) {
    return { lng: x / 10, lat: 90 - y / 10 };
  }
  fitBounds(): void {}
  easeTo(o: Record<string, unknown>): void {
    this.eased = o;
  }
  jumpTo(): void {}
  getZoom(): number {
    return 6;
  }
  getCenter() {
    return { lng: 25, lat: 62 };
  }
  getBounds() {
    return { getWest: () => 20, getSouth: () => 59, getEast: () => 32, getNorth: () => 71 };
  }
  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }
  getCanvasContainer(): HTMLElement {
    return this.canvas;
  }
  on(type: string, a: unknown, b?: unknown): void {
    const key = typeof a === 'string' ? `${type}@${a}` : type;
    const h = (typeof a === 'string' ? b : a) as Handler;
    this.handlers.set(key, [...(this.handlers.get(key) ?? []), h]);
  }
  off(): void {}
  once(): void {}
  isStyleLoaded(): boolean {
    return true;
  }
  loaded(): boolean {
    return true;
  }
  resize(): void {}
  remove(): void {}
  dragPan = {
    enable: () => (this.dragPanEnabled = true),
    disable: () => (this.dragPanEnabled = false),
  };

  fire(type: string, e: Partial<MapPointerEvent>, layer?: string): void {
    const evt = {
      point: { x: 0, y: 0 },
      lngLat: { lng: 0, lat: 0 },
      originalEvent: new MouseEvent(type),
      ...e,
    };
    for (const h of this.handlers.get(layer ? `${type}@${layer}` : type) ?? [])
      h(evt as MapPointerEvent);
  }
}

const engine: MapEngine = {
  kind: 'maplibre',
  fontStack: () => ['Open Sans Semibold'],
  create: () => Promise.reject(new Error('unused')),
  setBasemap: () => Promise.resolve(),
};

const fc: MapFeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      id: 42,
      geometry: { type: 'Point', coordinates: [25, 60.2] },
      properties: {
        id: 'FIQ-00042',
        name: 'Kallio Noise 03',
        type: 'NOISE',
        status: 'ALERT',
        municipality: 'Helsinki',
        region: 'Uusimaa',
        siteName: 'Helsinki – Kallio',
        batteryPct: 80,
        lastSeenAt: new Date().toISOString(),
        metric: 'NOISE',
        value: 88,
        unit: 'dB',
        pm25: null,
        glyph: 'N',
      },
    },
  ],
};

function setup() {
  const fake = new FakeMap();
  const calls = {
    hover: [] as unknown[],
    selected: [] as string[],
    bbox: [] as [unknown, boolean][],
    selectEnded: 0,
  };
  const cb: MapCallbacks = {
    hover: (h) => calls.hover.push(h),
    sensorSelected: (id) => calls.selected.push(id),
    bboxChanged: (b, final) => calls.bbox.push([b, final]),
    selectModeEnded: () => calls.selectEnded++,
    moved: () => undefined,
  };
  const c = new MapController(
    fake as unknown as GlMap,
    engine,
    ['Open Sans Semibold'],
    '/geo/finland.geojson',
    cb,
  );
  c.init();
  c.setSensors(fc, fc);
  return { fake, c, calls };
}

describe('MapController', () => {
  it('loads clustered and flat data', () => {
    const { fake } = setup();
    expect(fake.data.get(SOURCES.clustered)).toBe(fc);
    expect(fake.data.get(SOURCES.flat)).toBe(fc);
  });

  it('highlights a hovered sensor with feature-state and reports a tooltip', () => {
    const { fake, calls } = setup();
    fake.fire(
      'mousemove',
      { features: [{ id: 42, geometry: { type: 'Point' }, properties: {} }] },
      LAYERS.points,
    );
    expect(fake.featureState.get('sensors:42')).toEqual({ hover: true });
    expect(calls.hover.at(-1)).toMatchObject({
      tooltip: { kind: 'sensor', id: 'FIQ-00042' },
      keyboard: false,
    });
    fake.fire('mouseleave', {}, LAYERS.points);
    expect(fake.featureState.get('sensors:42')).toEqual({ hover: false });
    expect(calls.hover.at(-1)).toBeNull();
  });

  it('shows cluster breakdowns and zooms into clusters on click', async () => {
    const { fake, calls } = setup();
    const cluster: RenderedFeature = {
      id: 7,
      geometry: { type: 'Point', coordinates: [25, 61] },
      properties: { cluster_id: 7, point_count: 12, online: 10, alert: 2 },
    };
    fake.fire('mousemove', { features: [cluster] }, LAYERS.clusters);
    expect(calls.hover.at(-1)).toMatchObject({ tooltip: { kind: 'cluster', count: 12 } });
    fake.fire('click', { features: [cluster] }, LAYERS.clusters);
    await Promise.resolve();
    await Promise.resolve();
    expect(fake.eased).toEqual({ center: [25, 61], zoom: 8.5, duration: 500 });
  });

  it('selects a sensor on click', () => {
    const { fake, calls } = setup();
    fake.fire(
      'click',
      { features: [{ id: 42, geometry: { type: 'Point' }, properties: { id: 'FIQ-00042' } }] },
      LAYERS.points,
    );
    expect(calls.selected).toEqual(['FIQ-00042']);
  });

  it('cycles keyboard focus with N and opens with Enter', () => {
    const { fake, calls } = setup();
    fake.rendered = [
      {
        id: 42,
        layer: { id: LAYERS.points },
        geometry: { type: 'Point', coordinates: [25, 60.2] },
        properties: { id: 'FIQ-00042' },
      },
    ];
    fake.canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'n' }));
    expect(calls.hover.at(-1)).toMatchObject({ keyboard: true, tooltip: { id: 'FIQ-00042' } });
    fake.canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(calls.selected).toEqual(['FIQ-00042']);
    fake.canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(calls.hover.at(-1)).toBeNull();
    expect(fake.canvas.getAttribute('aria-label')).toContain('Press N or P');
  });

  it('draws a bounding box with Shift+drag', () => {
    const { fake, calls } = setup();
    const shift = new MouseEvent('mousedown', { shiftKey: true });
    fake.fire('mousedown', { lngLat: { lng: 25, lat: 60.4 }, originalEvent: shift });
    expect(fake.dragPanEnabled).toBe(false);
    fake.fire('mousemove', { lngLat: { lng: 24.7, lat: 60.1 } });
    fake.fire('mouseup', { lngLat: { lng: 24.6, lat: 60.0 } });
    expect(fake.dragPanEnabled).toBe(true);
    expect(calls.bbox.at(-1)).toEqual([
      { minLon: 24.6, minLat: 60.0, maxLon: 25, maxLat: 60.4 },
      true,
    ]);
    expect(calls.bbox.some(([, final]) => !final)).toBe(true);
  });

  it('ignores plain drags (panning) unless select mode is on', () => {
    const { fake, calls } = setup();
    fake.fire('mousedown', { lngLat: { lng: 25, lat: 60 } });
    fake.fire('mouseup', { lngLat: { lng: 26, lat: 61 } });
    expect(calls.bbox).toEqual([]);
    const { fake: f2, c, calls: calls2 } = setup();
    c.setSelectMode(true);
    f2.fire('mousedown', { lngLat: { lng: 25, lat: 60 } });
    f2.fire('mouseup', { lngLat: { lng: 26, lat: 61 } });
    expect(calls2.bbox.at(-1)?.[1]).toBe(true);
    expect(calls2.selectEnded).toBe(1);
  });

  it('drags a corner while keeping the opposite corner fixed', () => {
    const { fake, c, calls } = setup();
    c.setSelection({ minLon: 24, minLat: 60, maxLon: 25, maxLat: 61 });
    fake.fire(
      'mousedown',
      { features: [{ geometry: { type: 'Point' }, properties: { corner: 'ne' } }] },
      LAYERS.bboxCorners,
    );
    fake.fire('mouseup', { lngLat: { lng: 26, lat: 62 } });
    expect(calls.bbox.at(-1)).toEqual([{ minLon: 24, minLat: 60, maxLon: 26, maxLat: 62 }, true]);
  });

  it('switches layer modes and filters', () => {
    const { fake, c } = setup();
    c.setMode('heatmap');
    expect(fake.layout.get(LAYERS.heat)).toBe('visible');
    expect(fake.layout.get(LAYERS.clusters)).toBe('none');
    c.setFilter(['all', ['in', ['get', 'type'], ['literal', ['NOISE']]]]);
    expect(fake.filters.get(LAYERS.flatPoints)).toEqual([
      'all',
      ['in', ['get', 'type'], ['literal', ['NOISE']]],
    ]);
    expect(c.viewportBBox()).toEqual({ minLon: 20, minLat: 59, maxLon: 32, maxLat: 71 });
  });
});

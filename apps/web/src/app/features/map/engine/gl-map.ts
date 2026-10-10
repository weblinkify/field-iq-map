import type { MapEngineKind } from '../../../core/map-engine-choice';
import type { Basemap } from '../../../core/runtime-config';
import type { FilterExpression } from '../state/map-filter';

/**
 * The subset of the Mapbox GL / MapLibre GL Map API that FieldIQ uses. Both libraries implement
 * it with the same semantics, so components work against this interface and never import either
 * library directly.
 */
export interface LngLat {
  lng: number;
  lat: number;
}

export interface ScreenPoint {
  x: number;
  y: number;
}

export interface LayerSpec {
  id: string;
  type: string;
  source?: string;
  [key: string]: unknown;
}

export interface RenderedFeature {
  id?: number | string;
  layer?: { id: string };
  source?: string;
  geometry: { type: string; coordinates?: unknown };
  properties: Record<string, unknown> | null;
}

export interface MapPointerEvent {
  point: ScreenPoint;
  lngLat: LngLat;
  features?: RenderedFeature[];
  originalEvent: MouseEvent;
}

export interface GeoJsonSourceLike {
  setData(data: unknown): unknown;
  getClusterExpansionZoom(
    clusterId: number,
    callback?: (err: unknown, zoom: number) => void,
  ): unknown;
}

export interface BoundsLike {
  getWest(): number;
  getSouth(): number;
  getEast(): number;
  getNorth(): number;
}

export type BoundsInput = [[number, number], [number, number]];

export interface GlMap {
  addSource(id: string, source: Record<string, unknown>): unknown;
  getSource(id: string): GeoJsonSourceLike | undefined;
  addLayer(layer: LayerSpec, beforeId?: string): unknown;
  getLayer(id: string): unknown;
  setLayoutProperty(layer: string, name: string, value: unknown): unknown;
  setPaintProperty(layer: string, name: string, value: unknown): unknown;
  setFilter(layer: string, filter: FilterExpression | null): unknown;
  setFeatureState(feature: { source: string; id: number }, state: Record<string, boolean>): unknown;
  queryRenderedFeatures(options?: { layers?: string[] }): RenderedFeature[];
  project(lngLat: [number, number]): ScreenPoint;
  unproject(point: [number, number]): LngLat;
  fitBounds(bounds: BoundsInput, options?: Record<string, unknown>): unknown;
  easeTo(options: Record<string, unknown>): unknown;
  jumpTo(options: Record<string, unknown>): unknown;
  getZoom(): number;
  getCenter(): LngLat;
  getBounds(): BoundsLike;
  getCanvas(): HTMLCanvasElement;
  getCanvasContainer(): HTMLElement;
  on(type: string, layerOrListener: unknown, listener?: unknown): unknown;
  off(type: string, layerOrListener: unknown, listener?: unknown): unknown;
  once(type: string, listener: () => void): unknown;
  isStyleLoaded(): boolean | void;
  loaded(): boolean;
  resize(): unknown;
  remove(): void;
  dragPan: { enable(): void; disable(): void };
}

export interface CreateMapOptions {
  container: HTMLElement;
  bounds: BoundsInput;
  padding: number;
  dark: boolean;
  basemap: Basemap;
  mapboxToken: string | null;
}

/** Creates a map with the basemap loaded; FieldIQ layers are added afterwards. */
export interface MapEngine {
  readonly kind: MapEngineKind;
  /** Font stack for symbol layers (cluster counts, type glyphs) on the given basemap. */
  fontStack(basemap: Basemap): readonly string[];
  create(options: CreateMapOptions): Promise<GlMap>;
  /** Switch dark/light basemap; resolves when the new style is loaded. */
  setBasemap(map: GlMap, dark: boolean, basemap: Basemap): Promise<void>;
}

/** Normalises callback- (Mapbox) and promise-style (MapLibre) getClusterExpansionZoom. */
export function clusterExpansionZoom(
  source: GeoJsonSourceLike,
  clusterId: number,
): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    const result = source.getClusterExpansionZoom(clusterId, (err, zoom) =>
      err ? reject(err instanceof Error ? err : new Error(String(err))) : resolve(zoom),
    );
    if (result instanceof Promise) (result as Promise<number>).then(resolve, reject);
  });
}

/** Waits until the style is ready for addSource/addLayer. */
export function whenStyleLoaded(map: GlMap): Promise<void> {
  return new Promise((resolve) => {
    if (map.isStyleLoaded()) resolve();
    else map.once('style.load', () => resolve());
  });
}

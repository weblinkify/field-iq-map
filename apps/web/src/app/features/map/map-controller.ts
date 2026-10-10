import type { BBox, SensorFeatureProperties } from '../../api/rest/sensors-rest.service';
import {
  clusterExpansionZoom,
  type GlMap,
  type MapEngine,
  type MapPointerEvent,
  type RenderedFeature,
  type ScreenPoint,
} from './engine/gl-map';
import {
  addFieldIqLayers,
  applyLayerMode,
  bboxFeatures,
  EXPRESSION_FILTERED_LAYERS,
  LAYERS,
  SENSOR_LAYERS,
  SENSOR_SOURCE,
  SOURCES,
} from './engine/layers';
import type { MapFeature, MapFeatureCollection } from './state/features';
import { withBaseFilter, type FilterExpression } from './state/map-filter';
import { clusterTooltip, sensorTooltip, type Tooltip } from './state/tooltip';
import { normalizeBBox, type LayerMode } from './state/url-state';

export interface HoverState {
  tooltip: Tooltip;
  point: ScreenPoint;
  /** True when the hover comes from keyboard focus rather than the mouse. */
  keyboard: boolean;
}

export interface MapCallbacks {
  hover(state: HoverState | null): void;
  sensorSelected(id: string): void;
  /** Rectangle while drawing (final=false) and when released (final=true). */
  bboxChanged(bbox: BBox, final: boolean): void;
  selectModeEnded(): void;
  moved(): void;
}

interface HoverTarget {
  source: string;
  id: number;
}

type Corner = 'sw' | 'se' | 'ne' | 'nw';

/**
 * Imperative glue between the GL map and the Angular page: data, layers, hover/feature-state,
 * cluster zoom, keyboard focus and bounding-box drawing. Works with any {@link MapEngine}.
 */
export class MapController {
  private props = new Map<number, SensorFeatureProperties>();
  private hovered: HoverTarget | null = null;
  private mode: LayerMode = 'clusters';
  private userFilter: FilterExpression | null = null;
  private selection: BBox | null = null;
  private selectMode = false;
  private drawing: { anchor: [number, number] } | null = null;
  private keyboardIndex = -1;
  private keyboardTargets: RenderedFeature[] = [];
  private clustered: MapFeatureCollection = { type: 'FeatureCollection', features: [] };
  private flat: MapFeatureCollection = { type: 'FeatureCollection', features: [] };
  private readonly unlisten: (() => void)[] = [];

  constructor(
    readonly map: GlMap,
    readonly engine: MapEngine,
    private readonly fontStack: readonly string[],
    private readonly finlandUrl: string,
    private readonly cb: MapCallbacks,
  ) {}

  init(): void {
    addFieldIqLayers(this.map, this.fontStack, this.finlandUrl);
    this.bindPointer();
    this.bindKeyboard();
    this.listen('moveend', () => this.cb.moved());
  }

  /** Re-adds sources/layers after a basemap switch (setStyle drops them). */
  restoreAfterStyleChange(): void {
    addFieldIqLayers(this.map, this.fontStack, this.finlandUrl);
    this.setSensors(this.clustered, this.flat);
    this.setMode(this.mode);
    this.setFilter(this.userFilter);
    this.setSelection(this.selection);
  }

  destroy(): void {
    this.unlisten.forEach((off) => off());
    this.map.remove();
  }

  // ── data & styling ────────────────────────────────────────────────────────────────────
  /** Clustered data is pre-filtered in memory; the flat source holds everything. */
  setSensors(clustered: MapFeatureCollection, flat: MapFeatureCollection): void {
    this.clustered = clustered;
    this.flat = flat;
    this.props = new Map(flat.features.map((f: MapFeature) => [f.id, f.properties]));
    this.map.getSource(SOURCES.clustered)?.setData(clustered);
    this.map.getSource(SOURCES.flat)?.setData(flat);
  }

  setFilter(expression: FilterExpression | null): void {
    this.userFilter = expression;
    for (const id of EXPRESSION_FILTERED_LAYERS)
      this.map.setFilter(id, withBaseFilter(null, expression));
  }

  setMode(mode: LayerMode): void {
    this.clearHover();
    this.mode = mode;
    applyLayerMode(this.map, mode);
  }

  setSelection(bbox: BBox | null): void {
    this.selection = bbox;
    this.map.getSource(SOURCES.bbox)?.setData(bboxFeatures(bbox));
  }

  setSelectMode(on: boolean): void {
    this.selectMode = on;
    this.map.getCanvas().style.cursor = on ? 'crosshair' : '';
  }

  // ── camera ────────────────────────────────────────────────────────────────────────────
  fitBBox(b: BBox, padding = 48): void {
    this.map.fitBounds(
      [
        [b.minLon, b.minLat],
        [b.maxLon, b.maxLat],
      ],
      { padding, duration: 600 },
    );
  }

  flyTo(lon: number, lat: number, zoom = 13): void {
    this.map.easeTo({
      center: [lon, lat],
      zoom: Math.max(this.map.getZoom(), zoom),
      duration: 800,
    });
  }

  viewportBBox(): BBox {
    const b = this.map.getBounds();
    return {
      minLon: Math.max(-180, b.getWest()),
      minLat: Math.max(-90, b.getSouth()),
      maxLon: Math.min(180, b.getEast()),
      maxLat: Math.min(90, b.getNorth()),
    };
  }

  // ── hover / click ─────────────────────────────────────────────────────────────────────
  private bindPointer(): void {
    for (const layer of [LAYERS.points, LAYERS.flatPoints]) {
      this.listen('mousemove', (e) => this.hoverSensor(e), layer);
      this.listen('mouseleave', () => this.clearHover(), layer);
      this.listen('click', (e) => this.clickSensor(e), layer);
    }
    this.listen('mousemove', (e) => this.hoverCluster(e), LAYERS.clusters);
    this.listen('mouseleave', () => this.clearHover(), LAYERS.clusters);
    this.listen('click', (e) => void this.zoomIntoCluster(e.features?.[0]), LAYERS.clusters);

    this.listen('mousedown', (e) => this.startCornerDrag(e), LAYERS.bboxCorners);
    this.listen('mousedown', (e) => this.startDraw(e));
    this.listen('mousemove', (e) => this.updateDraw(e));
    this.listen('mouseup', (e) => this.finishDraw(e));
  }

  private hoverSensor(e: MapPointerEvent): void {
    if (this.drawing) return;
    const feature = e.features?.[0];
    const id = typeof feature?.id === 'number' ? feature.id : null;
    const props = id === null ? undefined : this.props.get(id);
    if (id === null || !props) return;
    this.setHover({ source: SENSOR_SOURCE[this.mode], id });
    this.cb.hover({ tooltip: sensorTooltip(props), point: e.point, keyboard: false });
  }

  private hoverCluster(e: MapPointerEvent): void {
    if (this.drawing) return;
    const feature = e.features?.[0];
    if (!feature?.properties) return;
    if (typeof feature.id === 'number')
      this.setHover({ source: SOURCES.clustered, id: feature.id });
    this.cb.hover({ tooltip: clusterTooltip(feature.properties), point: e.point, keyboard: false });
  }

  private clickSensor(e: MapPointerEvent): void {
    const sensorId = e.features?.[0]?.properties?.['id'];
    if (typeof sensorId === 'string') this.cb.sensorSelected(sensorId);
  }

  private async zoomIntoCluster(feature: RenderedFeature | undefined): Promise<void> {
    const clusterId = feature?.properties?.['cluster_id'];
    const coords = feature?.geometry.coordinates;
    const source = this.map.getSource(SOURCES.clustered);
    if (typeof clusterId !== 'number' || !Array.isArray(coords) || !source) return;
    const zoom = await clusterExpansionZoom(source, clusterId);
    this.map.easeTo({ center: coords, zoom: zoom + 0.5, duration: 500 });
  }

  private setHover(target: HoverTarget | null): void {
    if (this.hovered && (this.hovered.id !== target?.id || this.hovered.source !== target.source)) {
      this.map.setFeatureState(this.hovered, { hover: false });
    }
    this.hovered = target;
    if (target) this.map.setFeatureState(target, { hover: true });
    this.map.getCanvas().style.cursor = target ? 'pointer' : this.selectMode ? 'crosshair' : '';
  }

  private clearHover(): void {
    this.setHover(null);
    this.cb.hover(null);
  }

  // ── keyboard: N/P cycle through visible sensors and clusters, Enter opens, Esc clears ───
  private bindKeyboard(): void {
    const el = this.map.getCanvas();
    el.setAttribute(
      'aria-label',
      'Sensor map of Finland. Arrow keys pan, plus and minus zoom. Press N or P to move between visible sensors, Enter to open, Escape to clear.',
    );
    el.setAttribute('aria-describedby', 'map-keyboard-help');
    const onKey = (ev: KeyboardEvent) => this.onKey(ev);
    el.addEventListener('keydown', onKey);
    this.unlisten.push(() => el.removeEventListener('keydown', onKey));
  }

  private onKey(ev: KeyboardEvent): void {
    const key = ev.key.toLowerCase();
    if (key === 'n' || key === 'p') {
      ev.preventDefault();
      this.keyboardTargets = this.visibleTargets();
      if (this.keyboardTargets.length === 0) return;
      const step = key === 'n' ? 1 : -1;
      const count = this.keyboardTargets.length;
      this.keyboardIndex = (((this.keyboardIndex + step) % count) + count) % count;
      this.focusTarget(this.keyboardTargets[this.keyboardIndex]);
    } else if (key === 'enter') {
      const target = this.keyboardTargets[this.keyboardIndex];
      if (!target) return;
      ev.preventDefault();
      if (target.properties?.['cluster_id'] !== undefined) void this.zoomIntoCluster(target);
      else if (typeof target.properties?.['id'] === 'string')
        this.cb.sensorSelected(target.properties['id']);
    } else if (key === 'escape') {
      this.keyboardIndex = -1;
      this.clearHover();
      if (this.drawing) this.drawing = null;
    }
  }

  /** Rendered sensors/clusters ordered top-left to bottom-right (stable reading order). */
  private visibleTargets(): RenderedFeature[] {
    const layers = [
      ...SENSOR_LAYERS[this.mode],
      ...(this.mode === 'clusters' ? [LAYERS.clusters] : []),
    ];
    const seen = new Set<string>();
    const out: { f: RenderedFeature; p: ScreenPoint }[] = [];
    for (const f of this.map.queryRenderedFeatures({ layers })) {
      const coords = f.geometry.coordinates;
      if (!Array.isArray(coords)) continue;
      const key = `${f.layer?.id}:${String(f.id)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ f, p: this.map.project(coords as [number, number]) });
    }
    return out
      .sort((a, b) => Math.round(a.p.y / 40) - Math.round(b.p.y / 40) || a.p.x - b.p.x)
      .map((x) => x.f);
  }

  private focusTarget(f: RenderedFeature | undefined): void {
    const coords = f?.geometry.coordinates;
    if (!f || !Array.isArray(coords) || typeof f.id !== 'number') return;
    const point = this.map.project(coords as [number, number]);
    if (f.properties?.['cluster_id'] !== undefined) {
      this.setHover({ source: SOURCES.clustered, id: f.id });
      this.cb.hover({ tooltip: clusterTooltip(f.properties ?? {}), point, keyboard: true });
      return;
    }
    const props = this.props.get(f.id);
    if (!props) return;
    this.setHover({ source: SENSOR_SOURCE[this.mode], id: f.id });
    this.cb.hover({ tooltip: sensorTooltip(props), point, keyboard: true });
  }

  // ── bounding box: "Select area" mode or Shift+drag; corners are draggable ──────────────
  private startDraw(e: MapPointerEvent): void {
    if (this.drawing || !(this.selectMode || e.originalEvent.shiftKey)) return;
    (e as MapPointerEvent & { preventDefault?: () => void }).preventDefault?.();
    this.map.dragPan.disable();
    this.drawing = { anchor: [e.lngLat.lng, e.lngLat.lat] };
    this.clearHover();
  }

  private startCornerDrag(e: MapPointerEvent): void {
    const corner = e.features?.[0]?.properties?.['corner'] as Corner | undefined;
    const b = this.selection;
    if (!corner || !b) return;
    (e as MapPointerEvent & { preventDefault?: () => void }).preventDefault?.();
    e.originalEvent.stopPropagation();
    const opposite: Record<Corner, [number, number]> = {
      sw: [b.maxLon, b.maxLat],
      se: [b.minLon, b.maxLat],
      ne: [b.minLon, b.minLat],
      nw: [b.maxLon, b.minLat],
    };
    this.map.dragPan.disable();
    this.drawing = { anchor: opposite[corner] };
  }

  private updateDraw(e: MapPointerEvent): void {
    if (!this.drawing) return;
    const b = normalizeBBox(this.drawing.anchor, [e.lngLat.lng, e.lngLat.lat]);
    this.setSelection(b);
    this.cb.bboxChanged(b, false);
  }

  private finishDraw(e: MapPointerEvent): void {
    if (!this.drawing) return;
    const b = normalizeBBox(this.drawing.anchor, [e.lngLat.lng, e.lngLat.lat]);
    this.drawing = null;
    this.map.dragPan.enable();
    if (b.maxLon - b.minLon > 1e-6 && b.maxLat - b.minLat > 1e-6) {
      this.setSelection(b);
      this.cb.bboxChanged(b, true);
    } else {
      this.setSelection(this.selection);
    }
    if (this.selectMode) {
      this.setSelectMode(false);
      this.cb.selectModeEnded();
    }
  }

  private listen(type: string, handler: (e: MapPointerEvent) => void, layer?: string): void {
    if (layer) {
      this.map.on(type, layer, handler);
      this.unlisten.push(() => this.map.off(type, layer, handler));
    } else {
      this.map.on(type, handler);
      this.unlisten.push(() => this.map.off(type, handler));
    }
  }
}

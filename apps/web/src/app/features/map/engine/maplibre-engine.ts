import type { Basemap } from '../../../core/runtime-config';
import {
  swapStyle,
  whenStyleLoaded,
  type CreateMapOptions,
  type GlMap,
  type MapEngine,
} from './gl-map';
import { LOCAL_FONT_STACK, maplibreStyle, OPENFREEMAP_FONT_STACK } from './styles';

/** Free/offline fallback engine: MapLibre GL JS, no token required. */
export class MaplibreEngine implements MapEngine {
  readonly kind = 'maplibre' as const;

  fontStack(basemap: Basemap): readonly string[] {
    return basemap === 'openfreemap' ? OPENFREEMAP_FONT_STACK : LOCAL_FONT_STACK;
  }

  async create(o: CreateMapOptions): Promise<GlMap> {
    const maplibregl = await import('maplibre-gl');
    // The worker ships as a static asset so it resolves the same way in dev, prod and Docker.
    // Versioned URL so a stale cached copy (e.g. served with a wrong MIME type) is never reused.
    maplibregl.setWorkerUrl(
      `${location.origin}/maplibre/maplibre-gl-worker.mjs?v=${maplibregl.getVersion()}`,
    );
    const map = new maplibregl.Map({
      container: o.container,
      style: maplibreStyle(o.dark, o.basemap, location.origin) as never,
      bounds: o.bounds,
      fitBoundsOptions: { padding: o.padding },
      boxZoom: false,
      attributionControl: { compact: true },
      // Keep the drawing buffer so screenshots/E2E can read pixels.
      canvasContextAttributes: { preserveDrawingBuffer: true },
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
    map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-right');
    const gl = map as unknown as GlMap;
    await whenStyleLoaded(gl);
    return gl;
  }

  async setBasemap(map: GlMap, dark: boolean, basemap: Basemap): Promise<void> {
    await swapStyle(map, maplibreStyle(dark, basemap, location.origin));
  }
}

import {
  swapStyle,
  whenStyleLoaded,
  type CreateMapOptions,
  type GlMap,
  type MapEngine,
} from './gl-map';
import { MAPBOX_FONT_STACK, mapboxStyleUrl } from './styles';

/** Mapbox GL JS, used when MAPBOX_TOKEN holds a public (pk.*) token. */
export class MapboxEngine implements MapEngine {
  readonly kind = 'mapbox' as const;

  fontStack(): readonly string[] {
    return MAPBOX_FONT_STACK;
  }

  async create(o: CreateMapOptions): Promise<GlMap> {
    const mapboxgl = (await import('mapbox-gl')).default;
    mapboxgl.accessToken = o.mapboxToken ?? '';
    const map = new mapboxgl.Map({
      container: o.container,
      style: mapboxStyleUrl(o.dark),
      bounds: o.bounds,
      fitBoundsOptions: { padding: o.padding },
      boxZoom: false,
      projection: 'mercator',
      preserveDrawingBuffer: true,
    });
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'bottom-right');
    map.addControl(new mapboxgl.ScaleControl({ unit: 'metric' }), 'bottom-right');
    const gl = map as unknown as GlMap;
    await whenStyleLoaded(gl);
    return gl;
  }

  async setBasemap(map: GlMap, dark: boolean): Promise<void> {
    await swapStyle(map, mapboxStyleUrl(dark));
  }
}

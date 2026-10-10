import { TestBed } from '@angular/core/testing';
import { parseRuntimeConfig, RUNTIME_CONFIG } from '../../../core/runtime-config';
import { MAP_ENGINE } from './map-engine.provider';
import { clusterExpansionZoom, type GeoJsonSourceLike } from './gl-map';
import { maplibreStyle } from './styles';

describe('MAP_ENGINE', () => {
  function engineFor(mapboxToken: string | null) {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: RUNTIME_CONFIG, useValue: parseRuntimeConfig({ mapboxToken }) }],
    });
    return TestBed.inject(MAP_ENGINE);
  }

  it('selects Mapbox for a public token and MapLibre otherwise', () => {
    expect(engineFor('pk.abc').kind).toBe('mapbox');
    expect(engineFor(null).kind).toBe('maplibre');
    expect(engineFor('sk.secret').kind).toBe('maplibre');
  });

  it('uses engine-specific font stacks', () => {
    expect(engineFor('pk.abc').fontStack('openfreemap')).toContain('DIN Pro Medium');
    expect(engineFor(null).fontStack('offline')).toEqual(['Open Sans Semibold']);
    expect(engineFor(null).fontStack('openfreemap')).toEqual(['Noto Sans Bold']);
  });
});

describe('maplibreStyle', () => {
  it('uses keyless OpenFreeMap styles online', () => {
    expect(maplibreStyle(true, 'openfreemap', 'http://x')).toBe(
      'https://tiles.openfreemap.org/styles/dark',
    );
    expect(maplibreStyle(false, 'openfreemap', 'http://x')).toBe(
      'https://tiles.openfreemap.org/styles/positron',
    );
  });

  it('needs no network in offline mode', () => {
    const style = maplibreStyle(true, 'offline', 'http://x') as Record<string, unknown>;
    expect(style['sources']).toEqual({});
    expect(style['glyphs']).toBe('http://x/fonts/{fontstack}/{range}.pbf');
  });
});

describe('clusterExpansionZoom', () => {
  it('supports promise-style sources (MapLibre)', async () => {
    const source: GeoJsonSourceLike = {
      setData: () => undefined,
      getClusterExpansionZoom: () => Promise.resolve(9),
    };
    await expect(clusterExpansionZoom(source, 1)).resolves.toBe(9);
  });

  it('supports callback-style sources (Mapbox)', async () => {
    const source: GeoJsonSourceLike = {
      setData: () => undefined,
      getClusterExpansionZoom: (_id, cb) => cb?.(null, 11),
    };
    await expect(clusterExpansionZoom(source, 1)).resolves.toBe(11);
  });
});

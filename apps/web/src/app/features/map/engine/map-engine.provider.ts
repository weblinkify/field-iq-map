import { InjectionToken, inject } from '@angular/core';
import { selectMapEngine } from '../../../core/map-engine-choice';
import { RUNTIME_CONFIG } from '../../../core/runtime-config';
import type { MapEngine } from './gl-map';
import { MapboxEngine } from './mapbox-engine';
import { MaplibreEngine } from './maplibre-engine';

/** The active map engine, chosen from the runtime config (Mapbox with a token, else MapLibre). */
export const MAP_ENGINE = new InjectionToken<MapEngine>('MAP_ENGINE', {
  providedIn: 'root',
  factory: () =>
    selectMapEngine(inject(RUNTIME_CONFIG).mapboxToken) === 'mapbox'
      ? new MapboxEngine()
      : new MaplibreEngine(),
});

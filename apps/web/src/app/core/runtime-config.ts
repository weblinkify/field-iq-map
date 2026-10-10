import { InjectionToken } from '@angular/core';

export type ApiMode = 'mock' | 'live';
export type Basemap = 'carto' | 'offline';

/**
 * Configuration read at runtime from /env.js, which the web container writes at start-up from
 * environment variables. One image therefore works against the mock and the real API.
 */
export interface RuntimeConfig {
  apiMode: ApiMode;
  apiBaseUrl: string;
  graphqlUrl: string;
  mapboxToken: string | null;
  basemap: Basemap;
}

export type RawRuntimeConfig = Partial<Record<keyof RuntimeConfig, unknown>>;

declare global {
  interface Window {
    __FIELDIQ_CONFIG__?: RawRuntimeConfig;
  }
}

export const DEFAULT_CONFIG: RuntimeConfig = {
  apiMode: 'mock',
  apiBaseUrl: '/api/v1',
  graphqlUrl: '/graphql',
  mapboxToken: null,
  basemap: 'carto',
};

const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : null;

/** Normalises whatever env.js provides; unknown or blank values fall back to defaults. */
export function parseRuntimeConfig(raw: RawRuntimeConfig | undefined): RuntimeConfig {
  const mode = text(raw?.apiMode)?.toLowerCase();
  const basemap = text(raw?.basemap)?.toLowerCase();
  const token = text(raw?.mapboxToken);
  return {
    apiMode: mode === 'live' || mode === 'real' ? 'live' : 'mock',
    apiBaseUrl: (text(raw?.apiBaseUrl) ?? DEFAULT_CONFIG.apiBaseUrl).replace(/\/+$/, ''),
    graphqlUrl: text(raw?.graphqlUrl) ?? DEFAULT_CONFIG.graphqlUrl,
    // Ignore unsubstituted template placeholders such as "${MAPBOX_TOKEN}".
    mapboxToken: token && !token.startsWith('${') ? token : null,
    basemap: basemap === 'offline' ? 'offline' : 'carto',
  };
}

export const RUNTIME_CONFIG = new InjectionToken<RuntimeConfig>('RUNTIME_CONFIG', {
  providedIn: 'root',
  factory: () =>
    parseRuntimeConfig(typeof window === 'undefined' ? undefined : window.__FIELDIQ_CONFIG__),
});

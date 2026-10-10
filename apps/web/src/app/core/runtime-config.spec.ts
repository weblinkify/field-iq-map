import { DEFAULT_CONFIG, parseRuntimeConfig } from './runtime-config';

describe('parseRuntimeConfig', () => {
  it('falls back to defaults when env.js is missing', () => {
    expect(parseRuntimeConfig(undefined)).toEqual(DEFAULT_CONFIG);
  });

  it('accepts live/real as live mode and trims URLs', () => {
    expect(parseRuntimeConfig({ apiMode: 'real' }).apiMode).toBe('live');
    expect(parseRuntimeConfig({ apiMode: 'LIVE' }).apiMode).toBe('live');
    expect(parseRuntimeConfig({ apiMode: 'banana' }).apiMode).toBe('mock');
    expect(parseRuntimeConfig({ apiBaseUrl: 'https://x.test/api/v1/' }).apiBaseUrl).toBe(
      'https://x.test/api/v1',
    );
  });

  it('ignores blank or unsubstituted Mapbox tokens', () => {
    expect(parseRuntimeConfig({ mapboxToken: '' }).mapboxToken).toBeNull();
    expect(parseRuntimeConfig({ mapboxToken: '${MAPBOX_TOKEN}' }).mapboxToken).toBeNull();
    expect(parseRuntimeConfig({ mapboxToken: 42 }).mapboxToken).toBeNull();
    expect(parseRuntimeConfig({ mapboxToken: ' pk.abc ' }).mapboxToken).toBe('pk.abc');
  });

  it('parses the basemap option', () => {
    expect(parseRuntimeConfig({ basemap: 'offline' }).basemap).toBe('offline');
    expect(parseRuntimeConfig({ basemap: 'whatever' }).basemap).toBe('carto');
  });
});

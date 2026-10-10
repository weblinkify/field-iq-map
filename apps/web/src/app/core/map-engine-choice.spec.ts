import { selectMapEngine } from './map-engine-choice';

describe('selectMapEngine', () => {
  it('uses Mapbox with a public token', () => {
    expect(selectMapEngine('pk.eyJ1Ijoi')).toBe('mapbox');
  });

  it('falls back to MapLibre without a token', () => {
    expect(selectMapEngine(null)).toBe('maplibre');
  });

  it('never uses a secret or malformed token', () => {
    expect(selectMapEngine('sk.secret')).toBe('maplibre');
    expect(selectMapEngine('abc')).toBe('maplibre');
  });
});

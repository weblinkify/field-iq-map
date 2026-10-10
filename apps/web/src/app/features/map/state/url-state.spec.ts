import { convertToParamMap } from '@angular/router';
import { normalizeBBox, parseBBox, parseUrlState, serializeBBox, toQueryParams } from './url-state';

describe('bbox URL serialisation', () => {
  it('round-trips with 5 decimals', () => {
    const bbox = { minLon: 24.7000001, minLat: 60.1, maxLon: 25.25, maxLat: 60.35 };
    const text = serializeBBox(bbox);
    expect(text).toBe('24.7,60.1,25.25,60.35');
    expect(parseBBox(text)).toEqual({ minLon: 24.7, minLat: 60.1, maxLon: 25.25, maxLat: 60.35 });
  });

  it.each([
    '',
    '1,2,3',
    '1,2,3,4,5',
    'a,b,c,d',
    '25,60,24,61',
    '24,61,25,60',
    '-181,0,1,1',
    '0,-91,1,1',
    '24,,25,61',
  ])('rejects %j', (value) => {
    expect(parseBBox(value)).toBeNull();
  });

  it('normalises a rectangle drawn in any direction', () => {
    expect(normalizeBBox([25, 61], [24, 60])).toEqual({
      minLon: 24,
      minLat: 60,
      maxLon: 25,
      maxLat: 61,
    });
  });
});

describe('parseUrlState / toQueryParams', () => {
  it('parses a shared link', () => {
    const state = parseUrlState(
      convertToParamMap({
        sensor: 'FIQ-00042',
        bbox: '24.7,60.1,25.25,60.35',
        types: 'NOISE,BOGUS,MULTI',
        statuses: 'ALERT',
        regions: 'Uusimaa,Lappi',
        layer: 'heatmap',
      }),
    );
    expect(state).toEqual({
      sensor: 'FIQ-00042',
      bbox: { minLon: 24.7, minLat: 60.1, maxLon: 25.25, maxLat: 60.35 },
      filter: { types: ['NOISE', 'MULTI'], statuses: ['ALERT'], regions: ['Uusimaa', 'Lappi'] },
      layer: 'heatmap',
    });
    expect(toQueryParams(state)).toEqual({
      sensor: 'FIQ-00042',
      bbox: '24.7,60.1,25.25,60.35',
      types: 'NOISE,MULTI',
      statuses: 'ALERT',
      regions: 'Uusimaa,Lappi',
      layer: 'heatmap',
    });
  });

  it('ignores malformed values and removes defaults', () => {
    const state = parseUrlState(
      convertToParamMap({ sensor: '<script>', layer: 'nope', bbox: 'x' }),
    );
    expect(state.sensor).toBeNull();
    expect(state.layer).toBe('clusters');
    expect(state.bbox).toBeNull();
    expect(toQueryParams(state)).toEqual({
      sensor: null,
      bbox: null,
      types: null,
      statuses: null,
      regions: null,
      layer: null,
    });
  });
});

import {
  buildFilterExpression,
  EMPTY_FILTER,
  isEmptyFilter,
  matchesFilter,
  withBaseFilter,
  type MapFilter,
} from './map-filter';

/** Minimal evaluator for the expression subset we emit, to prove JS and GL semantics agree. */
function evaluate(expr: unknown, props: Record<string, string>): boolean {
  const e = expr as unknown[];
  if (e[0] === 'all') return e.slice(1).every((x) => evaluate(x, props));
  if (e[0] === 'in') {
    const key = (e[1] as unknown[])[1] as string;
    const values = (e[2] as unknown[])[1] as string[];
    return values.includes(props[key] ?? '');
  }
  throw new Error(`unsupported ${String(e[0])}`);
}

describe('map filter', () => {
  const sensors = [
    { type: 'NOISE', status: 'ALERT', region: 'Uusimaa' },
    { type: 'NOISE', status: 'ONLINE', region: 'Lappi' },
    { type: 'MULTI', status: 'ALERT', region: 'Lappi' },
    { type: 'TEMPERATURE', status: 'OFFLINE', region: 'Uusimaa' },
  ];

  it('produces no expression for an empty filter', () => {
    expect(buildFilterExpression(EMPTY_FILTER)).toBeNull();
    expect(isEmptyFilter(EMPTY_FILTER)).toBe(true);
    expect(sensors.every((s) => matchesFilter(s, EMPTY_FILTER))).toBe(true);
  });

  it('builds an all/in expression per dimension', () => {
    expect(
      buildFilterExpression({ types: ['NOISE'], statuses: ['ALERT', 'OFFLINE'], regions: [] }),
    ).toEqual([
      'all',
      ['in', ['get', 'type'], ['literal', ['NOISE']]],
      ['in', ['get', 'status'], ['literal', ['ALERT', 'OFFLINE']]],
    ]);
  });

  it.each<MapFilter>([
    { types: ['NOISE'], statuses: [], regions: [] },
    { types: [], statuses: ['ALERT'], regions: ['Lappi'] },
    { types: ['NOISE', 'MULTI'], statuses: ['ALERT'], regions: ['Uusimaa', 'Lappi'] },
    { types: ['HUMIDITY'], statuses: [], regions: [] },
  ])('expression and predicate agree for %o', (filter) => {
    const expr = buildFilterExpression(filter);
    for (const s of sensors) {
      expect(expr ? evaluate(expr, s) : true).toBe(matchesFilter(s, filter));
    }
  });

  it('combines base and user filters', () => {
    const base = ['!', ['has', 'point_count']];
    const user = buildFilterExpression({ types: ['NOISE'], statuses: [], regions: [] });
    expect(withBaseFilter(base, null)).toBe(base);
    expect(withBaseFilter(null, user)).toBe(user);
    expect(withBaseFilter(base, user)).toEqual(['all', base, user]);
    expect(withBaseFilter(null, null)).toBeNull();
  });
});

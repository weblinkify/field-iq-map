import { formatCoordinates, formatCount, formatPercent, formatValue, relativeTime } from './format';

describe('formatValue', () => {
  it('uses per-metric precision and the unit', () => {
    expect(formatValue(21.44, '°C', 'TEMPERATURE')).toBe('21.4 °C');
    expect(formatValue(64.4, '%', 'HUMIDITY')).toBe('64 %');
    expect(formatValue(52.6, 'dB', 'NOISE')).toBe('53 dB');
    expect(formatValue(8.25, 'µg/m³', 'PM25')).toBe('8.3 µg/m³');
    expect(formatValue(3, 'x')).toBe('3.0 x');
  });

  it('shows a dash for missing values', () => {
    expect(formatValue(null, '°C')).toBe('—');
    expect(formatValue(undefined, '°C')).toBe('—');
    expect(formatValue(Number.NaN, '°C')).toBe('—');
  });
});

describe('relativeTime', () => {
  const now = Date.parse('2026-10-10T12:00:00Z');
  it.each([
    ['2026-10-10T11:59:55Z', 'just now'],
    ['2026-10-10T11:59:15Z', '45 s ago'],
    ['2026-10-10T11:48:00Z', '12 min ago'],
    ['2026-10-10T09:00:00Z', '3 h ago'],
    ['2026-10-05T12:00:00Z', '5 d ago'],
    ['2026-10-10T12:00:30Z', 'just now'],
  ])('%s → %s', (iso, expected) => {
    expect(relativeTime(iso, now)).toBe(expected);
  });

  it('handles missing and invalid input', () => {
    expect(relativeTime(null, now)).toBe('—');
    expect(relativeTime('not a date', now)).toBe('—');
  });
});

describe('misc formatters', () => {
  it('formats percentages, coordinates and counts', () => {
    expect(formatPercent(3400, 4000)).toBe('85.0 %');
    expect(formatPercent(1, 0)).toBe('0 %');
    expect(formatCoordinates(60.123456, 24.987654)).toBe('60.12346, 24.98765');
    expect(formatCount(4000)).toBe('4,000');
  });
});

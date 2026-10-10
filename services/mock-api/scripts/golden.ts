/**
 * Writes shared/fixtures/readings-golden.json: sample outputs of the reading model.
 * services/api ReadingModelGoldenTest and test/readings.test.ts assert both
 * implementations reproduce these values.
 */
import { writeFileSync } from 'node:fs';
import { loadFixture, METRICS_BY_TYPE, SHARED_DIR } from '../src/domain/model.js';
import { readingValue } from '../src/domain/readings.js';

export function goldenSamples() {
  const { sensors } = loadFixture();
  const picks = sensors.filter((_, i) => i % 337 === 0 || i === 41);
  const extra = ['ALERT', 'LOW_BATTERY', 'OFFLINE'].map((status) =>
    sensors.find((s) => s.status === status),
  );
  const multi = sensors.find((s) => s.type === 'MULTI' && s.status === 'ALERT');
  const chosen = [
    ...new Map([...picks, ...extra, multi].flatMap((s) => (s ? [[s.id, s]] : []))).values(),
  ];
  const times = [
    '2026-01-15T03:00:00Z',
    '2026-04-01T07:55:00Z',
    '2026-06-21T12:00:00Z',
    '2026-10-10T16:30:00Z',
    '2026-12-31T23:59:59Z',
  ].map((t) => Date.parse(t) / 1000);
  return chosen.flatMap((s) =>
    METRICS_BY_TYPE[s.type].flatMap((metric) =>
      times.map((epochSecond) => ({
        sensorId: s.id,
        lat: s.lat,
        municipality: s.municipality,
        status: s.status,
        metric,
        epochSecond,
        value: readingValue(s, metric, epochSecond),
      })),
    ),
  );
}

if (process.argv[1]?.endsWith('golden.ts')) {
  const samples = goldenSamples();
  writeFileSync(
    `${SHARED_DIR}/fixtures/readings-golden.json`,
    `[\n${samples.map((s) => `  ${JSON.stringify(s)}`).join(',\n')}\n]\n`,
  );
  console.log(`Wrote ${samples.length} golden samples`);
}

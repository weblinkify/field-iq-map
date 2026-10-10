/**
 * Generates shared/fixtures/sensors.json — 4,000 deterministic sensors inside Finland.
 * Both the mock API and the real API (Postgres seeding) read this file, so both modes
 * show identical sensors.
 *
 *   npm run generate          # write the fixture
 *   npm run check             # fail if the committed fixture is stale
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { loadFinland, SENSORS_JSON } from './lib/boundary.js';
import { DEFAULT_SEED, generateFixture, SENSOR_COUNT, serializeFixture } from './lib/generator.js';

const fixture = generateFixture({
  seed: DEFAULT_SEED,
  total: SENSOR_COUNT,
  polygons: loadFinland(),
});
const output = serializeFixture(fixture);

if (process.argv.includes('--check')) {
  const current = readFileSync(SENSORS_JSON, 'utf8');
  if (current !== output) {
    console.error('shared/fixtures/sensors.json is out of date — run `make fixtures`.');
    process.exit(1);
  }
  console.log('sensors.json is up to date.');
} else {
  writeFileSync(SENSORS_JSON, output);
  console.log(`Wrote ${SENSORS_JSON}`, fixture.counts);
}

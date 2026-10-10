// Vercel builds this project with services/mock-api as the root directory. Copy the shared
// contract + fixture next to the function so they are bundled with it (.shared/ is git-ignored).
import { copyFileSync, mkdirSync } from 'node:fs';

const from = new URL('../../../shared/', import.meta.url);
const to = new URL('../.shared/', import.meta.url);
for (const file of ['graphql/schema.graphqls', 'fixtures/sensors.json']) {
  mkdirSync(new URL(file.split('/')[0] + '/', to), { recursive: true });
  copyFileSync(new URL(file, from), new URL(file, to));
}
console.log('copied shared contract + fixture to .shared/');

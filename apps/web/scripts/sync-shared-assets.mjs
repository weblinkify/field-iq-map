// Copies shared/geo/finland.geojson into public/geo/ (Angular only serves assets inside the
// workspace). Runs before start/build; the copy is git-ignored.
import { copyFileSync, mkdirSync } from 'node:fs';

mkdirSync(new URL('../public/geo/', import.meta.url), { recursive: true });
copyFileSync(
  new URL('../../../shared/geo/finland.geojson', import.meta.url),
  new URL('../public/geo/finland.geojson', import.meta.url),
);

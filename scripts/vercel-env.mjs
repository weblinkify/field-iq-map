// Writes the runtime config (env.js) into the Vercel static output, mirroring what the Docker
// web image does at container start. Mock mode; MAPBOX_TOKEN / BASEMAP come from Vercel env vars.
import { writeFileSync } from 'node:fs';

const out = new URL('../apps/web/dist/web/browser/env.js', import.meta.url);
const config = {
  apiMode: 'mock',
  apiBaseUrl: '/api/v1',
  graphqlUrl: '/graphql',
  mapboxToken: process.env.MAPBOX_TOKEN ?? '',
  basemap: process.env.BASEMAP ?? 'openfreemap',
};
writeFileSync(out, `window.__FIELDIQ_CONFIG__ = ${JSON.stringify(config, null, 2)};\n`);
console.log('vercel: wrote env.js', { ...config, mapboxToken: config.mapboxToken ? '(set)' : '' });

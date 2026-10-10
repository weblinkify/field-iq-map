// Vercel build step: writes env.js (runtime config) into the static output, like the Docker web
// image does at container start. The web project proxies /api and /graphql to the mock-api
// project (see vercel.json), so the browser stays same-origin.
import { writeFileSync } from 'node:fs';

const config = {
  apiMode: process.env.API_MODE ?? 'mock',
  apiBaseUrl: '/api/v1',
  graphqlUrl: '/graphql',
  mapboxToken: process.env.MAPBOX_TOKEN ?? '',
  basemap: process.env.BASEMAP ?? 'openfreemap',
};
writeFileSync(
  new URL('../dist/web/browser/env.js', import.meta.url),
  `window.__FIELDIQ_CONFIG__ = ${JSON.stringify(config, null, 2)};\n`,
);
console.log('vercel: wrote env.js', { ...config, mapboxToken: config.mapboxToken ? '(set)' : '' });

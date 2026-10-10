// Vercel serverless entry for the FieldIQ mock API. vercel.json rewrites every path here and
// passes the original path in `__route`; the shared files are bundled from .shared/.
import { fileURLToPath } from 'node:url';

process.env.FIELDIQ_SHARED_DIR ??= fileURLToPath(new URL('../.shared', import.meta.url));
const { createApp } = await import('../dist/app.js');
const app = createApp();

export default function handler(req, res) {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const route = url.searchParams.get('__route');
  if (route !== null) {
    url.searchParams.delete('__route');
    const query = url.searchParams.toString();
    req.url = `/${route.replace(/^\/+/, '')}${query ? `?${query}` : ''}`;
  }
  return app(req, res);
}

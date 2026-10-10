// Vercel serverless function: the FieldIQ mock API (same GraphQL + REST contract as the real
// Spring Boot API), built from services/mock-api. vercel.json rewrites /api/v1/*, /graphql and
// /graphiql here and passes the original path in `__route`.
import { createApp } from '../services/mock-api/dist/app.js';

const app = createApp();

export default function handler(req, res) {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const route = url.searchParams.get('__route');
  if (route) {
    url.searchParams.delete('__route');
    const query = url.searchParams.toString();
    req.url = `${route}${query ? `?${query}` : ''}`;
  }
  return app(req, res);
}

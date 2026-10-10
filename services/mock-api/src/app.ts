import express, { type Express } from 'express';

export function createApp(): Express {
  const app = express();
  app.disable('x-powered-by');

  app.get('/api/v1/health', (_req, res) => {
    res.json({ status: 'UP', mode: 'mock', version: '2.0.0', time: new Date().toISOString() });
  });

  return app;
}

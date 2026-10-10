import express, { type Express } from 'express';
import { createGraphQl } from './graphql.js';
import { loadFixture } from './domain/model.js';
import { SensorStore } from './domain/store.js';
import { createRestRouter } from './rest.js';

export function createApp(store: SensorStore = new SensorStore(loadFixture())): Express {
  const app = express();
  app.disable('x-powered-by');
  app.set('etag', 'strong');

  const yoga = createGraphQl(store);
  app.all(yoga.graphqlEndpoint, (req, res) => yoga(req, res));
  app.get('/graphiql', (_req, res) => res.redirect(302, '/graphql'));
  app.use('/api/v1', createRestRouter(store));

  return app;
}

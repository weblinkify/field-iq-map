import { provideHttpClient, withFetch } from '@angular/common/http';
import { type ApplicationConfig, inject, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { InMemoryCache } from '@apollo/client/core';
import { provideApollo } from 'apollo-angular';
import { HttpLink } from 'apollo-angular/http';
import { routes } from './app.routes';
import { RUNTIME_CONFIG } from './core/runtime-config';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withFetch()),
    provideApollo(() => ({
      link: inject(HttpLink).create({ uri: inject(RUNTIME_CONFIG).graphqlUrl }),
      cache: new InMemoryCache(),
      defaultOptions: { watchQuery: { fetchPolicy: 'cache-and-network' } },
    })),
  ],
};

import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import { ApolloTestingController, ApolloTestingModule } from 'apollo-angular/testing';
import { TestBed } from '@angular/core/testing';
import { KpisDocument } from './api/generated/graphql';
import { App } from './app';
import { RUNTIME_CONFIG, parseRuntimeConfig } from './core/runtime-config';

describe('App shell', () => {
  async function setup(mode: 'mock' | 'live', mapboxToken: string | null = null) {
    await render(App, {
      imports: [ApolloTestingModule],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: RUNTIME_CONFIG, useValue: parseRuntimeConfig({ apiMode: mode, mapboxToken }) },
      ],
    });
    return {
      apollo: TestBed.inject(ApolloTestingController),
      http: TestBed.inject(HttpTestingController),
    };
  }

  it('renders navigation for every FieldIQ page', async () => {
    await setup('mock');
    for (const name of ['Map', 'Dashboard', 'Sites', 'Devices', 'Alerts']) {
      expect(screen.getByRole('link', { name })).toBeTruthy();
    }
  });

  it('shows the mock badge and MapLibre without a token, then trusts /health', async () => {
    const { http } = await setup('mock');
    expect(screen.getByTestId('mode-badge').textContent).toContain('MOCK API');
    expect(screen.getByTestId('engine-badge').textContent).toContain('MapLibre');
    http.expectOne('/api/v1/health').flush({ status: 'UP', mode: 'live', version: '2', time: 'x' });
    await screen.findByText('LIVE API');
  });

  it('shows Mapbox when a public token is configured', async () => {
    await setup('live', 'pk.test');
    expect(screen.getByTestId('engine-badge').textContent).toContain('Mapbox');
  });

  it('renders KPIs from GraphQL', async () => {
    const { apollo } = await setup('live');
    apollo.expectOne(KpisDocument).flush({
      data: {
        sensorStats: {
          __typename: 'SensorStats',
          total: 4000,
          activeAlerts: 600,
          regionsCovered: 19,
          byStatus: [{ __typename: 'StatusCount', status: 'ONLINE', count: 3400 }],
        },
      },
    });
    expect((await screen.findByTestId('kpi-total')).textContent).toContain('4,000');
    expect(screen.getByTestId('kpi-online').textContent).toContain('85.0 %');
    expect(screen.getByTestId('kpi-alerts').textContent).toContain('600');
    expect(screen.getByTestId('kpi-regions').textContent).toContain('19');
  });
});

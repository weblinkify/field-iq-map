import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import { ApolloTestingController, ApolloTestingModule } from 'apollo-angular/testing';
import { AreaSensorsDocument, AreaStatsDocument } from '../../../api/generated/graphql';
import { AreaStatsPanel, toGraphQlFilter } from './area-stats-panel';

const bbox = { minLon: 24.7, minLat: 60.1, maxLon: 25.25, maxLat: 60.35 };

describe('AreaStatsPanel', () => {
  it('renders sensorStats for the bbox and the first page of sensors', async () => {
    const { fixture } = await render(AreaStatsPanel, {
      imports: [ApolloTestingModule],
      providers: [provideHttpClient(), provideHttpClientTesting()],
      inputs: { bbox, filter: { types: ['NOISE'], statuses: [], regions: [] } },
    });
    const apollo = TestBed.inject(ApolloTestingController);

    const statsOp = apollo.expectOne(AreaStatsDocument);
    expect(statsOp.operation.variables).toEqual({
      bbox,
      filter: { types: ['NOISE'], statuses: null, regions: null },
    });
    statsOp.flush({
      data: {
        sensorStats: {
          __typename: 'SensorStats',
          total: 625,
          activeAlerts: 97,
          regionsCovered: 1,
          byStatus: [
            { __typename: 'StatusCount', status: 'ONLINE', count: 528 },
            { __typename: 'StatusCount', status: 'ALERT', count: 42 },
          ],
          byType: [{ __typename: 'TypeCount', type: 'NOISE', count: 625 }],
          averages: [
            {
              __typename: 'MetricAverage',
              metric: 'TEMPERATURE',
              average: 15.27,
              unit: '°C',
              sampleSize: 100,
            },
            {
              __typename: 'MetricAverage',
              metric: 'PM25',
              average: null,
              unit: 'µg/m³',
              sampleSize: 0,
            },
          ],
        },
      },
    });
    const sensorsOp = apollo.expectOne(AreaSensorsDocument);
    expect(sensorsOp.operation.variables['first']).toBe(25);
    sensorsOp.flush({
      data: {
        sensors: {
          __typename: 'SensorConnection',
          totalCount: 625,
          pageInfo: { __typename: 'PageInfo', hasNextPage: true, endCursor: 'abc' },
          edges: [
            {
              __typename: 'SensorEdge',
              cursor: 'abc',
              node: {
                __typename: 'Sensor',
                id: 'FIQ-00002',
                name: 'Kamppi Noise 01',
                type: 'NOISE',
                status: 'ONLINE',
                municipality: 'Helsinki',
                batteryPct: 76,
              },
            },
          ],
        },
      },
    });
    fixture.detectChanges();

    expect((await screen.findByTestId('area-total')).textContent).toContain('625');
    expect(screen.getByTestId('area-avg-TEMPERATURE').textContent).toContain('15.3 °C');
    expect(screen.getByTestId('area-avg-PM25').textContent).toContain('—');
    expect(screen.getByTestId('area-status-ALERT').textContent).toContain('42');
    expect(screen.getByText('Kamppi Noise 01')).toBeTruthy();
    expect(screen.getByText(/1–1 of\s+625/)).toBeTruthy();
    expect(screen.getByTestId('export-csv').getAttribute('href')).toBe(
      '/api/v1/export/sensors.csv?bbox=24.7,60.1,25.25,60.35&type=NOISE',
    );
  });
});

describe('toGraphQlFilter', () => {
  it('maps empty filters to null and empty lists to null', () => {
    expect(toGraphQlFilter({ types: [], statuses: [], regions: [] })).toBeNull();
    expect(toGraphQlFilter({ types: [], statuses: ['ALERT'], regions: ['Lappi'] })).toEqual({
      types: null,
      statuses: ['ALERT'],
      regions: ['Lappi'],
    });
  });
});

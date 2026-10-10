import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { RUNTIME_CONFIG, parseRuntimeConfig } from '../../core/runtime-config';
import { SensorsRestService, type SensorFeatureCollection } from './sensors-rest.service';

describe('SensorsRestService', () => {
  let service: SensorsRestService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: RUNTIME_CONFIG, useValue: parseRuntimeConfig({ apiBaseUrl: '/api/v1' }) },
      ],
    });
    service = TestBed.inject(SensorsRestService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads the GeoJSON with bbox and filters', async () => {
    const body: SensorFeatureCollection = { type: 'FeatureCollection', features: [] };
    const result = firstValueFrom(
      service.geojson({
        bbox: { minLon: 24.5, minLat: 60.1, maxLon: 25.3, maxLat: 60.4 },
        types: ['NOISE', 'MULTI'],
        statuses: ['ALERT'],
      }),
    );
    const req = http.expectOne(
      (r) => r.url === '/api/v1/sensors.geojson' && r.params.get('bbox') === '24.5,60.1,25.3,60.4',
    );
    expect(req.request.params.get('type')).toBe('NOISE,MULTI');
    expect(req.request.params.get('status')).toBe('ALERT');
    expect(req.request.params.has('region')).toBe(false);
    req.flush(body);
    expect(await result).toEqual(body);
  });

  it('requests health', async () => {
    const result = firstValueFrom(service.health());
    http.expectOne('/api/v1/health').flush({ status: 'UP', mode: 'live', version: '2', time: 'x' });
    expect((await result).mode).toBe('live');
  });

  it('builds CSV export URLs', () => {
    expect(service.csvExportUrl()).toBe('/api/v1/export/sensors.csv');
    expect(
      service.csvExportUrl({
        bbox: { minLon: 1, minLat: 2, maxLon: 3, maxLat: 4 },
        regions: ['Lappi'],
      }),
    ).toBe('/api/v1/export/sensors.csv?bbox=1,2,3,4&region=Lappi');
  });
});

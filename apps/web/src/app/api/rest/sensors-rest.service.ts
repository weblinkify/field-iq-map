import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { RUNTIME_CONFIG } from '../../core/runtime-config';
import type { SensorStatus, SensorType } from '../generated/graphql';
import type { components } from '../generated/openapi';

export type SensorFeatureCollection = components['schemas']['SensorFeatureCollection'];
export type SensorFeature = components['schemas']['SensorFeature'];
export type SensorFeatureProperties = components['schemas']['SensorFeatureProperties'];
export type HealthResponse = components['schemas']['HealthResponse'];

export interface BBox {
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
}

export interface RestFilter {
  bbox?: BBox | null;
  types?: readonly SensorType[];
  statuses?: readonly SensorStatus[];
  regions?: readonly string[];
}

export const bboxParam = (b: BBox): string => [b.minLon, b.minLat, b.maxLon, b.maxLat].join(',');

/** REST client for bulk map data. Types come from shared/openapi/openapi.yaml. */
@Injectable({ providedIn: 'root' })
export class SensorsRestService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(RUNTIME_CONFIG);

  health(): Observable<HealthResponse> {
    return this.http.get<HealthResponse>(`${this.config.apiBaseUrl}/health`);
  }

  /** All sensors (optionally filtered) as one GeoJSON FeatureCollection. */
  geojson(filter: RestFilter = {}): Observable<SensorFeatureCollection> {
    return this.http.get<SensorFeatureCollection>(`${this.config.apiBaseUrl}/sensors.geojson`, {
      params: this.params(filter),
    });
  }

  /** Absolute URL of the CSV export for a download link. */
  csvExportUrl(filter: RestFilter = {}): string {
    const query = this.params(filter).toString();
    return `${this.config.apiBaseUrl}/export/sensors.csv${query ? `?${query}` : ''}`;
  }

  private params(filter: RestFilter): HttpParams {
    let params = new HttpParams();
    if (filter.bbox) params = params.set('bbox', bboxParam(filter.bbox));
    if (filter.types?.length) params = params.set('type', filter.types.join(','));
    if (filter.statuses?.length) params = params.set('status', filter.statuses.join(','));
    if (filter.regions?.length) params = params.set('region', filter.regions.join(','));
    return params;
  }
}

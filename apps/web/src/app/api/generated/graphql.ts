/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
export type AlertSeverity =
  | 'CRITICAL'
  | 'WARNING';

/** Bounding box in WGS84. lon -180..180, lat -90..90, min < max. */
export type BBoxInput = {
  maxLat: number;
  maxLon: number;
  minLat: number;
  minLon: number;
};

export type Metric =
  | 'HUMIDITY'
  | 'NOISE'
  | 'PM25'
  | 'TEMPERATURE';

export type SensorFilter = {
  regions?: Array<string> | null | undefined;
  /** Case-insensitive match on id, name, municipality or site name. */
  search?: string | null | undefined;
  statuses?: Array<SensorStatus> | null | undefined;
  types?: Array<SensorType> | null | undefined;
};

export type SensorStatus =
  | 'ALERT'
  | 'LOW_BATTERY'
  | 'OFFLINE'
  | 'ONLINE';

export type SensorType =
  | 'AIR_QUALITY_PM25'
  | 'HUMIDITY'
  | 'MULTI'
  | 'NOISE'
  | 'TEMPERATURE';

export type AreaStatsQueryVariables = Exact<{
  bbox?: BBoxInput | null | undefined;
  filter?: SensorFilter | null | undefined;
}>;


export type AreaStatsQuery = { sensorStats: { total: number, activeAlerts: number, regionsCovered: number, byStatus: Array<{ status: SensorStatus, count: number }>, byType: Array<{ type: SensorType, count: number }>, averages: Array<{ metric: Metric, average: number | null, unit: string, sampleSize: number }> } };

export type AreaSensorsQueryVariables = Exact<{
  bbox?: BBoxInput | null | undefined;
  filter?: SensorFilter | null | undefined;
  first?: number | null | undefined;
  after?: string | null | undefined;
}>;


export type AreaSensorsQuery = { sensors: { totalCount: number, pageInfo: { hasNextPage: boolean, endCursor: string | null }, edges: Array<{ cursor: string, node: { id: string, name: string, type: SensorType, status: SensorStatus, municipality: string, batteryPct: number } }> } };

export type KpisQueryVariables = Exact<{ [key: string]: never; }>;


export type KpisQuery = { sensorStats: { total: number, activeAlerts: number, regionsCovered: number, byStatus: Array<{ status: SensorStatus, count: number }> } };

export type DashboardQueryVariables = Exact<{ [key: string]: never; }>;


export type DashboardQuery = { sensorStats: { total: number, activeAlerts: number, regionsCovered: number, byStatus: Array<{ status: SensorStatus, count: number }>, byType: Array<{ type: SensorType, count: number }>, averages: Array<{ metric: Metric, average: number | null, unit: string, sampleSize: number }> }, regions: Array<{ region: string, sensorCount: number, onlineCount: number, alertCount: number }> };

export type SitesQueryVariables = Exact<{
  region?: string | null | undefined;
}>;


export type SitesQuery = { sites: Array<{ id: string, name: string, municipality: string, region: string, sensorCount: number, location: { lat: number, lon: number } }> };

export type DevicesQueryVariables = Exact<{
  filter?: SensorFilter | null | undefined;
  first?: number | null | undefined;
  after?: string | null | undefined;
}>;


export type DevicesQuery = { sensors: { totalCount: number, pageInfo: { hasNextPage: boolean, endCursor: string | null }, edges: Array<{ node: { id: string, name: string, type: SensorType, status: SensorStatus, municipality: string, region: string, siteName: string, batteryPct: number, firmware: string, lastSeenAt: string } }> } };

export type AlertsQueryVariables = Exact<{
  activeOnly?: boolean | null | undefined;
  first?: number | null | undefined;
}>;


export type AlertsQuery = { alerts: Array<{ id: string, sensorId: string, sensorName: string, severity: AlertSeverity, message: string, createdAt: string, resolvedAt: string | null }> };

export type RegionsQueryVariables = Exact<{ [key: string]: never; }>;


export type RegionsQuery = { regions: Array<{ region: string, sensorCount: number }> };

export type SensorDetailQueryVariables = Exact<{
  id: string | number;
}>;


export type SensorDetailQuery = { sensor: { id: string, name: string, type: SensorType, status: SensorStatus, municipality: string, region: string, siteName: string, batteryPct: number, firmware: string, installedAt: string, lastSeenAt: string, location: { lat: number, lon: number }, site: { id: string, name: string, sensorCount: number }, latestReadings: Array<{ metric: Metric, value: number, unit: string, ts: string }>, readings: Array<{ ts: string, metric: Metric, value: number, unit: string }>, alerts: Array<{ id: string, severity: AlertSeverity, message: string, createdAt: string }> } | null };

export const AreaStatsDocument = gql`
    query AreaStats($bbox: BBoxInput, $filter: SensorFilter) {
  sensorStats(bbox: $bbox, filter: $filter) {
    total
    activeAlerts
    regionsCovered
    byStatus {
      status
      count
    }
    byType {
      type
      count
    }
    averages {
      metric
      average
      unit
      sampleSize
    }
  }
}
    `;

  @Injectable({
    providedIn: 'root'
  })
  export class AreaStatsGQL extends Apollo.Query<AreaStatsQuery, AreaStatsQueryVariables> {
    override document = AreaStatsDocument;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }
export const AreaSensorsDocument = gql`
    query AreaSensors($bbox: BBoxInput, $filter: SensorFilter, $first: Int, $after: String) {
  sensors(bbox: $bbox, filter: $filter, first: $first, after: $after) {
    totalCount
    pageInfo {
      hasNextPage
      endCursor
    }
    edges {
      cursor
      node {
        id
        name
        type
        status
        municipality
        batteryPct
      }
    }
  }
}
    `;

  @Injectable({
    providedIn: 'root'
  })
  export class AreaSensorsGQL extends Apollo.Query<AreaSensorsQuery, AreaSensorsQueryVariables> {
    override document = AreaSensorsDocument;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }
export const KpisDocument = gql`
    query Kpis {
  sensorStats {
    total
    activeAlerts
    regionsCovered
    byStatus {
      status
      count
    }
  }
}
    `;

  @Injectable({
    providedIn: 'root'
  })
  export class KpisGQL extends Apollo.Query<KpisQuery, KpisQueryVariables> {
    override document = KpisDocument;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }
export const DashboardDocument = gql`
    query Dashboard {
  sensorStats {
    total
    activeAlerts
    regionsCovered
    byStatus {
      status
      count
    }
    byType {
      type
      count
    }
    averages {
      metric
      average
      unit
      sampleSize
    }
  }
  regions {
    region
    sensorCount
    onlineCount
    alertCount
  }
}
    `;

  @Injectable({
    providedIn: 'root'
  })
  export class DashboardGQL extends Apollo.Query<DashboardQuery, DashboardQueryVariables> {
    override document = DashboardDocument;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }
export const SitesDocument = gql`
    query Sites($region: String) {
  sites(region: $region) {
    id
    name
    municipality
    region
    sensorCount
    location {
      lat
      lon
    }
  }
}
    `;

  @Injectable({
    providedIn: 'root'
  })
  export class SitesGQL extends Apollo.Query<SitesQuery, SitesQueryVariables> {
    override document = SitesDocument;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }
export const DevicesDocument = gql`
    query Devices($filter: SensorFilter, $first: Int, $after: String) {
  sensors(filter: $filter, first: $first, after: $after) {
    totalCount
    pageInfo {
      hasNextPage
      endCursor
    }
    edges {
      node {
        id
        name
        type
        status
        municipality
        region
        siteName
        batteryPct
        firmware
        lastSeenAt
      }
    }
  }
}
    `;

  @Injectable({
    providedIn: 'root'
  })
  export class DevicesGQL extends Apollo.Query<DevicesQuery, DevicesQueryVariables> {
    override document = DevicesDocument;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }
export const AlertsDocument = gql`
    query Alerts($activeOnly: Boolean, $first: Int) {
  alerts(activeOnly: $activeOnly, first: $first) {
    id
    sensorId
    sensorName
    severity
    message
    createdAt
    resolvedAt
  }
}
    `;

  @Injectable({
    providedIn: 'root'
  })
  export class AlertsGQL extends Apollo.Query<AlertsQuery, AlertsQueryVariables> {
    override document = AlertsDocument;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }
export const RegionsDocument = gql`
    query Regions {
  regions {
    region
    sensorCount
  }
}
    `;

  @Injectable({
    providedIn: 'root'
  })
  export class RegionsGQL extends Apollo.Query<RegionsQuery, RegionsQueryVariables> {
    override document = RegionsDocument;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }
export const SensorDetailDocument = gql`
    query SensorDetail($id: ID!) {
  sensor(id: $id) {
    id
    name
    type
    status
    municipality
    region
    siteName
    batteryPct
    firmware
    installedAt
    lastSeenAt
    location {
      lat
      lon
    }
    site {
      id
      name
      sensorCount
    }
    latestReadings {
      metric
      value
      unit
      ts
    }
    readings {
      ts
      metric
      value
      unit
    }
    alerts(activeOnly: true) {
      id
      severity
      message
      createdAt
    }
  }
}
    `;

  @Injectable({
    providedIn: 'root'
  })
  export class SensorDetailGQL extends Apollo.Query<SensorDetailQuery, SensorDetailQueryVariables> {
    override document = SensorDetailDocument;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }
import type { GraphQLResolveInfo, GraphQLScalarType, GraphQLScalarTypeConfig } from 'graphql';
import type { SensorModel, SiteModel, AlertModel } from '../domain/model.js';
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;
export type RequireFields<T, K extends keyof T> = Omit<T, K> & { [P in K]-?: NonNullable<T[P]> };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
  /** ISO-8601 timestamp in UTC, e.g. 2026-10-10T12:00:00Z */
  DateTime: { input: Date; output: Date; }
};

export type Alert = {
  __typename?: 'Alert';
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  message: Scalars['String']['output'];
  resolvedAt?: Maybe<Scalars['DateTime']['output']>;
  sensorId: Scalars['ID']['output'];
  sensorName: Scalars['String']['output'];
  severity: AlertSeverity;
};

export type AlertSeverity =
  | 'CRITICAL'
  | 'WARNING';

/** Bounding box in WGS84. lon -180..180, lat -90..90, min < max. */
export type BBoxInput = {
  maxLat: Scalars['Float']['input'];
  maxLon: Scalars['Float']['input'];
  minLat: Scalars['Float']['input'];
  minLon: Scalars['Float']['input'];
};

/** WGS84 coordinates (EPSG:4326). */
export type Coordinates = {
  __typename?: 'Coordinates';
  lat: Scalars['Float']['output'];
  lon: Scalars['Float']['output'];
};

export type Metric =
  | 'HUMIDITY'
  | 'NOISE'
  | 'PM25'
  | 'TEMPERATURE';

export type MetricAverage = {
  __typename?: 'MetricAverage';
  /** Average of the latest readings, null when no sensor in scope measures the metric. */
  average?: Maybe<Scalars['Float']['output']>;
  metric: Metric;
  sampleSize: Scalars['Int']['output'];
  unit: Scalars['String']['output'];
};

export type PageInfo = {
  __typename?: 'PageInfo';
  endCursor?: Maybe<Scalars['String']['output']>;
  hasNextPage: Scalars['Boolean']['output'];
};

export type Query = {
  __typename?: 'Query';
  alerts: Array<Alert>;
  regions: Array<RegionSummary>;
  sensor?: Maybe<Sensor>;
  /** Counts by status/type and averages of the latest readings. */
  sensorStats: SensorStats;
  /** Cursor-paginated, ordered by id. first defaults to 20 (max 200). */
  sensors: SensorConnection;
  sites: Array<Site>;
};


export type QueryAlertsArgs = {
  activeOnly?: InputMaybe<Scalars['Boolean']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
};


export type QuerySensorArgs = {
  id: Scalars['ID']['input'];
};


export type QuerySensorStatsArgs = {
  bbox?: InputMaybe<BBoxInput>;
  filter?: InputMaybe<SensorFilter>;
};


export type QuerySensorsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  bbox?: InputMaybe<BBoxInput>;
  filter?: InputMaybe<SensorFilter>;
  first?: InputMaybe<Scalars['Int']['input']>;
};


export type QuerySitesArgs = {
  region?: InputMaybe<Scalars['String']['input']>;
};

export type Reading = {
  __typename?: 'Reading';
  metric: Metric;
  sensorId: Scalars['ID']['output'];
  ts: Scalars['DateTime']['output'];
  unit: Scalars['String']['output'];
  value: Scalars['Float']['output'];
};

export type RegionSummary = {
  __typename?: 'RegionSummary';
  alertCount: Scalars['Int']['output'];
  onlineCount: Scalars['Int']['output'];
  region: Scalars['String']['output'];
  sensorCount: Scalars['Int']['output'];
};

export type Sensor = {
  __typename?: 'Sensor';
  alerts: Array<Alert>;
  batteryPct: Scalars['Int']['output'];
  firmware: Scalars['String']['output'];
  /** Stable identifier, e.g. FIQ-00042 */
  id: Scalars['ID']['output'];
  installedAt: Scalars['DateTime']['output'];
  lastSeenAt: Scalars['DateTime']['output'];
  /** Most recent value for every metric this sensor measures. */
  latestReadings: Array<Reading>;
  location: Coordinates;
  municipality: Scalars['String']['output'];
  name: Scalars['String']['output'];
  /** Hourly history. Defaults to the last 24 hours, all metrics. */
  readings: Array<Reading>;
  /** Region (maakunta) */
  region: Scalars['String']['output'];
  site: Site;
  siteName: Scalars['String']['output'];
  status: SensorStatus;
  type: SensorType;
};


export type SensorAlertsArgs = {
  activeOnly?: InputMaybe<Scalars['Boolean']['input']>;
};


export type SensorReadingsArgs = {
  from?: InputMaybe<Scalars['DateTime']['input']>;
  metric?: InputMaybe<Metric>;
  to?: InputMaybe<Scalars['DateTime']['input']>;
};

export type SensorConnection = {
  __typename?: 'SensorConnection';
  edges: Array<SensorEdge>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
};

export type SensorEdge = {
  __typename?: 'SensorEdge';
  cursor: Scalars['String']['output'];
  node: Sensor;
};

export type SensorFilter = {
  regions?: InputMaybe<Array<Scalars['String']['input']>>;
  /** Case-insensitive match on id, name, municipality or site name. */
  search?: InputMaybe<Scalars['String']['input']>;
  statuses?: InputMaybe<Array<SensorStatus>>;
  types?: InputMaybe<Array<SensorType>>;
};

export type SensorStats = {
  __typename?: 'SensorStats';
  activeAlerts: Scalars['Int']['output'];
  averages: Array<MetricAverage>;
  byStatus: Array<StatusCount>;
  byType: Array<TypeCount>;
  regionsCovered: Scalars['Int']['output'];
  total: Scalars['Int']['output'];
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

export type Site = {
  __typename?: 'Site';
  id: Scalars['ID']['output'];
  location: Coordinates;
  municipality: Scalars['String']['output'];
  name: Scalars['String']['output'];
  region: Scalars['String']['output'];
  sensorCount: Scalars['Int']['output'];
};

export type StatusCount = {
  __typename?: 'StatusCount';
  count: Scalars['Int']['output'];
  status: SensorStatus;
};

export type TypeCount = {
  __typename?: 'TypeCount';
  count: Scalars['Int']['output'];
  type: SensorType;
};



export type ResolverTypeWrapper<T> = Promise<T> | T;


export type ResolverWithResolve<TResult, TParent, TContext, TArgs> = {
  resolve: ResolverFn<TResult, TParent, TContext, TArgs>;
};
export type Resolver<TResult, TParent = Record<PropertyKey, never>, TContext = Record<PropertyKey, never>, TArgs = Record<PropertyKey, never>> = ResolverFn<TResult, TParent, TContext, TArgs> | ResolverWithResolve<TResult, TParent, TContext, TArgs>;

export type ResolverFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => Promise<TResult> | TResult;

export type SubscriptionSubscribeFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => AsyncIterable<TResult> | Promise<AsyncIterable<TResult>>;

export type SubscriptionResolveFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => TResult | Promise<TResult>;

export interface SubscriptionSubscriberObject<TResult, TKey extends string, TParent, TContext, TArgs> {
  subscribe: SubscriptionSubscribeFn<{ [key in TKey]: TResult }, TParent, TContext, TArgs>;
  resolve?: SubscriptionResolveFn<TResult, { [key in TKey]: TResult }, TContext, TArgs>;
}

export interface SubscriptionResolverObject<TResult, TParent, TContext, TArgs> {
  subscribe: SubscriptionSubscribeFn<any, TParent, TContext, TArgs>;
  resolve: SubscriptionResolveFn<TResult, any, TContext, TArgs>;
}

export type SubscriptionObject<TResult, TKey extends string, TParent, TContext, TArgs> =
  | SubscriptionSubscriberObject<TResult, TKey, TParent, TContext, TArgs>
  | SubscriptionResolverObject<TResult, TParent, TContext, TArgs>;

export type SubscriptionResolver<TResult, TKey extends string, TParent = Record<PropertyKey, never>, TContext = Record<PropertyKey, never>, TArgs = Record<PropertyKey, never>> =
  | ((...args: any[]) => SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>)
  | SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>;

export type TypeResolveFn<TTypes, TParent = Record<PropertyKey, never>, TContext = Record<PropertyKey, never>> = (
  parent: TParent,
  context: TContext,
  info: GraphQLResolveInfo
) => Maybe<TTypes> | Promise<Maybe<TTypes>>;

export type IsTypeOfResolverFn<T = Record<PropertyKey, never>, TContext = Record<PropertyKey, never>> = (obj: T, context: TContext, info: GraphQLResolveInfo) => boolean | Promise<boolean>;

export type NextResolverFn<T> = () => Promise<T>;

export type DirectiveResolverFn<TResult = Record<PropertyKey, never>, TParent = Record<PropertyKey, never>, TContext = Record<PropertyKey, never>, TArgs = Record<PropertyKey, never>> = (
  next: NextResolverFn<TResult>,
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => TResult | Promise<TResult>;





/** Mapping between all available schema types and the resolvers types */
export type ResolversTypes = {
  Alert: ResolverTypeWrapper<AlertModel>;
  AlertSeverity: AlertSeverity;
  BBoxInput: BBoxInput;
  Boolean: ResolverTypeWrapper<Scalars['Boolean']['output']>;
  Coordinates: ResolverTypeWrapper<Coordinates>;
  DateTime: ResolverTypeWrapper<Scalars['DateTime']['output']>;
  Float: ResolverTypeWrapper<Scalars['Float']['output']>;
  ID: ResolverTypeWrapper<Scalars['ID']['output']>;
  Int: ResolverTypeWrapper<Scalars['Int']['output']>;
  Metric: Metric;
  MetricAverage: ResolverTypeWrapper<MetricAverage>;
  PageInfo: ResolverTypeWrapper<PageInfo>;
  Query: ResolverTypeWrapper<Record<PropertyKey, never>>;
  Reading: ResolverTypeWrapper<Reading>;
  RegionSummary: ResolverTypeWrapper<RegionSummary>;
  Sensor: ResolverTypeWrapper<SensorModel>;
  SensorConnection: ResolverTypeWrapper<Omit<SensorConnection, 'edges'> & { edges: Array<ResolversTypes['SensorEdge']> }>;
  SensorEdge: ResolverTypeWrapper<Omit<SensorEdge, 'node'> & { node: ResolversTypes['Sensor'] }>;
  SensorFilter: SensorFilter;
  SensorStats: ResolverTypeWrapper<SensorStats>;
  SensorStatus: SensorStatus;
  SensorType: SensorType;
  Site: ResolverTypeWrapper<SiteModel>;
  StatusCount: ResolverTypeWrapper<StatusCount>;
  String: ResolverTypeWrapper<Scalars['String']['output']>;
  TypeCount: ResolverTypeWrapper<TypeCount>;
};

/** Mapping between all available schema types and the resolvers parents */
export type ResolversParentTypes = {
  Alert: AlertModel;
  BBoxInput: BBoxInput;
  Boolean: Scalars['Boolean']['output'];
  Coordinates: Coordinates;
  DateTime: Scalars['DateTime']['output'];
  Float: Scalars['Float']['output'];
  ID: Scalars['ID']['output'];
  Int: Scalars['Int']['output'];
  MetricAverage: MetricAverage;
  PageInfo: PageInfo;
  Query: Record<PropertyKey, never>;
  Reading: Reading;
  RegionSummary: RegionSummary;
  Sensor: SensorModel;
  SensorConnection: Omit<SensorConnection, 'edges'> & { edges: Array<ResolversParentTypes['SensorEdge']> };
  SensorEdge: Omit<SensorEdge, 'node'> & { node: ResolversParentTypes['Sensor'] };
  SensorFilter: SensorFilter;
  SensorStats: SensorStats;
  Site: SiteModel;
  StatusCount: StatusCount;
  String: Scalars['String']['output'];
  TypeCount: TypeCount;
};

export type AlertResolvers<ContextType = any, ParentType extends ResolversParentTypes['Alert'] = ResolversParentTypes['Alert']> = {
  createdAt?: Resolver<ResolversTypes['DateTime'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  message?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  resolvedAt?: Resolver<Maybe<ResolversTypes['DateTime']>, ParentType, ContextType>;
  sensorId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  sensorName?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  severity?: Resolver<ResolversTypes['AlertSeverity'], ParentType, ContextType>;
};

export type CoordinatesResolvers<ContextType = any, ParentType extends ResolversParentTypes['Coordinates'] = ResolversParentTypes['Coordinates']> = {
  lat?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  lon?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
};

export interface DateTimeScalarConfig extends GraphQLScalarTypeConfig<ResolversTypes['DateTime'], any> {
  name: 'DateTime';
}

export type MetricAverageResolvers<ContextType = any, ParentType extends ResolversParentTypes['MetricAverage'] = ResolversParentTypes['MetricAverage']> = {
  average?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  metric?: Resolver<ResolversTypes['Metric'], ParentType, ContextType>;
  sampleSize?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  unit?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
};

export type PageInfoResolvers<ContextType = any, ParentType extends ResolversParentTypes['PageInfo'] = ResolversParentTypes['PageInfo']> = {
  endCursor?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  hasNextPage?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
};

export type QueryResolvers<ContextType = any, ParentType extends ResolversParentTypes['Query'] = ResolversParentTypes['Query']> = {
  alerts?: Resolver<Array<ResolversTypes['Alert']>, ParentType, ContextType, RequireFields<QueryAlertsArgs, 'activeOnly' | 'first'>>;
  regions?: Resolver<Array<ResolversTypes['RegionSummary']>, ParentType, ContextType>;
  sensor?: Resolver<Maybe<ResolversTypes['Sensor']>, ParentType, ContextType, RequireFields<QuerySensorArgs, 'id'>>;
  sensorStats?: Resolver<ResolversTypes['SensorStats'], ParentType, ContextType, Partial<QuerySensorStatsArgs>>;
  sensors?: Resolver<ResolversTypes['SensorConnection'], ParentType, ContextType, RequireFields<QuerySensorsArgs, 'first'>>;
  sites?: Resolver<Array<ResolversTypes['Site']>, ParentType, ContextType, Partial<QuerySitesArgs>>;
};

export type ReadingResolvers<ContextType = any, ParentType extends ResolversParentTypes['Reading'] = ResolversParentTypes['Reading']> = {
  metric?: Resolver<ResolversTypes['Metric'], ParentType, ContextType>;
  sensorId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  ts?: Resolver<ResolversTypes['DateTime'], ParentType, ContextType>;
  unit?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  value?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
};

export type RegionSummaryResolvers<ContextType = any, ParentType extends ResolversParentTypes['RegionSummary'] = ResolversParentTypes['RegionSummary']> = {
  alertCount?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  onlineCount?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  region?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  sensorCount?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
};

export type SensorResolvers<ContextType = any, ParentType extends ResolversParentTypes['Sensor'] = ResolversParentTypes['Sensor']> = {
  alerts?: Resolver<Array<ResolversTypes['Alert']>, ParentType, ContextType, RequireFields<SensorAlertsArgs, 'activeOnly'>>;
  batteryPct?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  firmware?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  installedAt?: Resolver<ResolversTypes['DateTime'], ParentType, ContextType>;
  lastSeenAt?: Resolver<ResolversTypes['DateTime'], ParentType, ContextType>;
  latestReadings?: Resolver<Array<ResolversTypes['Reading']>, ParentType, ContextType>;
  location?: Resolver<ResolversTypes['Coordinates'], ParentType, ContextType>;
  municipality?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  readings?: Resolver<Array<ResolversTypes['Reading']>, ParentType, ContextType, Partial<SensorReadingsArgs>>;
  region?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  site?: Resolver<ResolversTypes['Site'], ParentType, ContextType>;
  siteName?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  status?: Resolver<ResolversTypes['SensorStatus'], ParentType, ContextType>;
  type?: Resolver<ResolversTypes['SensorType'], ParentType, ContextType>;
};

export type SensorConnectionResolvers<ContextType = any, ParentType extends ResolversParentTypes['SensorConnection'] = ResolversParentTypes['SensorConnection']> = {
  edges?: Resolver<Array<ResolversTypes['SensorEdge']>, ParentType, ContextType>;
  pageInfo?: Resolver<ResolversTypes['PageInfo'], ParentType, ContextType>;
  totalCount?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
};

export type SensorEdgeResolvers<ContextType = any, ParentType extends ResolversParentTypes['SensorEdge'] = ResolversParentTypes['SensorEdge']> = {
  cursor?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  node?: Resolver<ResolversTypes['Sensor'], ParentType, ContextType>;
};

export type SensorStatsResolvers<ContextType = any, ParentType extends ResolversParentTypes['SensorStats'] = ResolversParentTypes['SensorStats']> = {
  activeAlerts?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  averages?: Resolver<Array<ResolversTypes['MetricAverage']>, ParentType, ContextType>;
  byStatus?: Resolver<Array<ResolversTypes['StatusCount']>, ParentType, ContextType>;
  byType?: Resolver<Array<ResolversTypes['TypeCount']>, ParentType, ContextType>;
  regionsCovered?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  total?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
};

export type SiteResolvers<ContextType = any, ParentType extends ResolversParentTypes['Site'] = ResolversParentTypes['Site']> = {
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  location?: Resolver<ResolversTypes['Coordinates'], ParentType, ContextType>;
  municipality?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  region?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  sensorCount?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
};

export type StatusCountResolvers<ContextType = any, ParentType extends ResolversParentTypes['StatusCount'] = ResolversParentTypes['StatusCount']> = {
  count?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  status?: Resolver<ResolversTypes['SensorStatus'], ParentType, ContextType>;
};

export type TypeCountResolvers<ContextType = any, ParentType extends ResolversParentTypes['TypeCount'] = ResolversParentTypes['TypeCount']> = {
  count?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  type?: Resolver<ResolversTypes['SensorType'], ParentType, ContextType>;
};

export type Resolvers<ContextType = any> = {
  Alert?: AlertResolvers<ContextType>;
  Coordinates?: CoordinatesResolvers<ContextType>;
  DateTime?: GraphQLScalarType;
  MetricAverage?: MetricAverageResolvers<ContextType>;
  PageInfo?: PageInfoResolvers<ContextType>;
  Query?: QueryResolvers<ContextType>;
  Reading?: ReadingResolvers<ContextType>;
  RegionSummary?: RegionSummaryResolvers<ContextType>;
  Sensor?: SensorResolvers<ContextType>;
  SensorConnection?: SensorConnectionResolvers<ContextType>;
  SensorEdge?: SensorEdgeResolvers<ContextType>;
  SensorStats?: SensorStatsResolvers<ContextType>;
  Site?: SiteResolvers<ContextType>;
  StatusCount?: StatusCountResolvers<ContextType>;
  TypeCount?: TypeCountResolvers<ContextType>;
};


import type { SensorStatus } from '../../../api/generated/graphql';
import type { SensorFeatureProperties } from '../../../api/rest/sensors-rest.service';
import { formatValue, relativeTime } from '../../../core/format';
import {
  SENSOR_STATUSES,
  STATUS_COLORS,
  STATUS_LABELS,
  TYPE_LABELS,
} from '../../../core/sensor-meta';

export interface SensorTooltip {
  kind: 'sensor';
  id: string;
  name: string;
  typeLabel: string;
  status: SensorStatus;
  statusLabel: string;
  statusColor: string;
  place: string;
  value: string;
  battery: string;
  lastSeen: string;
}

export interface ClusterTooltip {
  kind: 'cluster';
  count: number;
  breakdown: { status: SensorStatus; label: string; color: string; count: number }[];
}

export type Tooltip = SensorTooltip | ClusterTooltip;

/** Aggregates computed by the clustered source (see layers.ts clusterProperties). */
export const CLUSTER_STATUS_KEYS: Record<SensorStatus, string> = {
  ONLINE: 'online',
  ALERT: 'alert',
  LOW_BATTERY: 'lowBattery',
  OFFLINE: 'offline',
};

export function sensorTooltip(p: SensorFeatureProperties, now: number = Date.now()): SensorTooltip {
  return {
    kind: 'sensor',
    id: p.id,
    name: p.name,
    typeLabel: TYPE_LABELS[p.type],
    status: p.status,
    statusLabel: STATUS_LABELS[p.status],
    statusColor: STATUS_COLORS[p.status],
    place: `${p.municipality} · ${p.siteName}`,
    value: formatValue(p.value, p.unit, p.metric),
    battery: `${p.batteryPct} %`,
    lastSeen: relativeTime(p.lastSeenAt, now),
  };
}

export function clusterTooltip(props: Record<string, unknown>): ClusterTooltip {
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  return {
    kind: 'cluster',
    count: num(props['point_count']),
    breakdown: SENSOR_STATUSES.map((status) => ({
      status,
      label: STATUS_LABELS[status],
      color: STATUS_COLORS[status],
      count: num(props[CLUSTER_STATUS_KEYS[status]]),
    })).filter((b) => b.count > 0),
  };
}

/** Plain-text version announced to screen readers. */
export function tooltipText(t: Tooltip): string {
  if (t.kind === 'cluster') {
    return `Cluster of ${t.count} sensors: ${t.breakdown.map((b) => `${b.count} ${b.label.toLowerCase()}`).join(', ')}`;
  }
  return `${t.name} (${t.id}), ${t.typeLabel}, ${t.statusLabel}. ${t.place}. Latest ${t.value}. Battery ${t.battery}. Last seen ${t.lastSeen}.`;
}

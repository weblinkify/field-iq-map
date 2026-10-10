import type { SensorFeatureProperties } from '../../../api/rest/sensors-rest.service';
import { clusterTooltip, sensorTooltip, tooltipText } from './tooltip';

const props: SensorFeatureProperties = {
  id: 'FIQ-00042',
  name: 'Kallio Noise 03',
  type: 'NOISE',
  status: 'ALERT',
  municipality: 'Helsinki',
  region: 'Uusimaa',
  siteName: 'Helsinki – Kallio',
  batteryPct: 77,
  lastSeenAt: '2026-10-10T11:59:15Z',
  metric: 'NOISE',
  value: 88.36,
  unit: 'dB',
  pm25: null,
};
const now = Date.parse('2026-10-10T12:00:00Z');

describe('sensorTooltip', () => {
  it('formats every field', () => {
    expect(sensorTooltip(props, now)).toEqual({
      kind: 'sensor',
      id: 'FIQ-00042',
      name: 'Kallio Noise 03',
      typeLabel: 'Noise',
      status: 'ALERT',
      statusLabel: 'Alert',
      statusColor: '#ef4444',
      place: 'Helsinki · Helsinki – Kallio',
      value: '88 dB',
      battery: '77 %',
      lastSeen: '45 s ago',
    });
  });

  it('shows a dash when the sensor has no reading', () => {
    expect(sensorTooltip({ ...props, value: null }, now).value).toBe('—');
  });

  it('has an accessible text form', () => {
    expect(tooltipText(sensorTooltip(props, now))).toBe(
      'Kallio Noise 03 (FIQ-00042), Noise, Alert. Helsinki · Helsinki – Kallio. Latest 88 dB. Battery 77 %. Last seen 45 s ago.',
    );
  });
});

describe('clusterTooltip', () => {
  it('summarises count and non-zero statuses in legend order', () => {
    const t = clusterTooltip({
      point_count: 120,
      online: 100,
      alert: 15,
      offline: 5,
      lowBattery: 0,
    });
    expect(t.count).toBe(120);
    expect(t.breakdown.map((b) => [b.status, b.count])).toEqual([
      ['ONLINE', 100],
      ['ALERT', 15],
      ['OFFLINE', 5],
    ]);
    expect(tooltipText(t)).toBe('Cluster of 120 sensors: 100 online, 15 alert, 5 offline');
  });

  it('tolerates missing aggregates', () => {
    expect(clusterTooltip({}).count).toBe(0);
  });
});

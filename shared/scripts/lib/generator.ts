import { bboxOf, distanceKm, pointInPolygons, type Polygon } from './geo.js';
import { GENERIC_DISTRICTS, MUNICIPALITIES, type Municipality } from './municipalities.js';
import { Rng } from './rng.js';

export const SENSOR_TYPES = [
  'TEMPERATURE',
  'HUMIDITY',
  'NOISE',
  'AIR_QUALITY_PM25',
  'MULTI',
] as const;
export const SENSOR_STATUSES = ['ONLINE', 'OFFLINE', 'ALERT', 'LOW_BATTERY'] as const;
export const METRICS = ['TEMPERATURE', 'HUMIDITY', 'NOISE', 'PM25'] as const;

export type SensorType = (typeof SENSOR_TYPES)[number];
export type SensorStatus = (typeof SENSOR_STATUSES)[number];
export type Metric = (typeof METRICS)[number];
export type AlertSeverity = 'WARNING' | 'CRITICAL';

export interface FixtureSensor {
  id: string;
  name: string;
  type: SensorType;
  status: SensorStatus;
  lat: number;
  lon: number;
  municipality: string;
  region: string;
  siteId: string;
  siteName: string;
  installedAt: string;
  batteryPct: number;
  firmware: string;
  /** Relative to "now" when the API starts (real) or serves the request (mock). */
  lastSeenSecondsAgo: number;
}

export interface FixtureSite {
  id: string;
  name: string;
  municipality: string;
  region: string;
  lat: number;
  lon: number;
  sensorCount: number;
}

export interface FixtureAlert {
  id: string;
  sensorId: string;
  severity: AlertSeverity;
  message: string;
  createdSecondsAgo: number;
  resolvedSecondsAgo: number | null;
}

export interface Fixture {
  version: 1;
  seed: number;
  generatedBy: string;
  counts: { sensors: number; sites: number; alerts: number; activeAlerts: number };
  sites: FixtureSite[];
  sensors: FixtureSensor[];
  alerts: FixtureAlert[];
}

export interface GeneratorOptions {
  seed: number;
  total: number;
  polygons: readonly Polygon[];
}

export const DEFAULT_SEED = 20261010;
export const SENSOR_COUNT = 4000;

/** Status mix: ~85% online, 7% alert, 5% offline, 3% low battery (exact for 4,000). */
const STATUS_SHARE: readonly (readonly [SensorStatus, number])[] = [
  ['ALERT', 0.07],
  ['OFFLINE', 0.05],
  ['LOW_BATTERY', 0.03],
];

const OTHER_MUNICIPALITY_SENSORS = 1450;
const LAPLAND_SPARSE_SENSORS = 150;
const LAPLAND_MIN_LAT = 66.0;
const FIRMWARE: readonly (readonly [string, number])[] = [
  ['2.3.1', 10],
  ['2.4.0', 25],
  ['2.4.2', 45],
  ['2.5.0', 20],
];
const URBAN_TYPES: readonly (readonly [SensorType, number])[] = [
  ['TEMPERATURE', 20],
  ['HUMIDITY', 15],
  ['NOISE', 25],
  ['AIR_QUALITY_PM25', 25],
  ['MULTI', 15],
];
const RURAL_TYPES: readonly (readonly [SensorType, number])[] = [
  ['TEMPERATURE', 35],
  ['HUMIDITY', 25],
  ['NOISE', 5],
  ['AIR_QUALITY_PM25', 15],
  ['MULTI', 20],
];
const TYPE_LABEL: Record<SensorType, string> = {
  TEMPERATURE: 'Temperature',
  HUMIDITY: 'Humidity',
  NOISE: 'Noise',
  AIR_QUALITY_PM25: 'Air Quality',
  MULTI: 'Multisensor',
};

interface Placed {
  lat: number;
  lon: number;
  municipality: Municipality;
  urban: boolean;
}

const round5 = (n: number) => Math.round(n * 1e5) / 1e5;
const pad = (n: number, width: number) => String(n).padStart(width, '0');

/** Distributes `total` across weights with the largest-remainder method (exact sum). */
export function allocate(weights: readonly number[], total: number): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  const raw = weights.map((w) => (w / sum) * total);
  const out = raw.map(Math.floor);
  const order = raw
    .map((r, i) => [r - Math.floor(r), i] as const)
    .sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  let left = total - out.reduce((a, b) => a + b, 0);
  for (const [, i] of order) {
    if (left-- <= 0) break;
    out[i] = (out[i] ?? 0) + 1;
  }
  return out;
}

function nearestMunicipality(lat: number, lon: number): Municipality {
  let best = MUNICIPALITIES[0] as Municipality;
  let bestKm = Infinity;
  for (const m of MUNICIPALITIES) {
    const km = distanceKm(lat, lon, m.lat, m.lon);
    if (km < bestKm) {
      bestKm = km;
      best = m;
    }
  }
  return best;
}

export function generateFixture({ seed, total, polygons }: GeneratorOptions): Fixture {
  const rng = new Rng(seed);
  const inside = (lat: number, lon: number) => pointInPolygons(lon, lat, polygons);
  const box = bboxOf(polygons);
  const placed: Placed[] = [];

  /** Gaussian scatter around a town centre, rejecting points outside Finland (at sea / abroad). */
  const scatter = (m: Municipality, spreadKm: number): Placed => {
    for (let attempt = 0; attempt < 10_000; attempt++) {
      const sigma = spreadKm * (attempt < 500 ? 1 : 2);
      const lat = m.lat + (rng.gaussian() * sigma) / 111.32;
      const lon = m.lon + (rng.gaussian() * sigma) / (111.32 * Math.cos((m.lat * Math.PI) / 180));
      if (inside(lat, lon)) return { lat, lon, municipality: m, urban: true };
    }
    throw new Error(`Could not place a sensor near ${m.name}`);
  };

  /** Uniform point inside Finland within a latitude band. */
  const uniform = (minLat: number, maxLat: number): Placed => {
    for (;;) {
      const lat = rng.range(Math.max(minLat, box.minLat), Math.min(maxLat, box.maxLat));
      const lon = rng.range(box.minLon, box.maxLon);
      if (inside(lat, lon))
        return { lat, lon, municipality: nearestMunicipality(lat, lon), urban: false };
    }
  };

  const centres = MUNICIPALITIES.filter((m) => m.sensors !== undefined);
  const others = MUNICIPALITIES.filter((m) => m.sensors === undefined);
  for (const m of centres)
    for (let i = 0; i < (m.sensors ?? 0); i++) placed.push(scatter(m, m.spreadKm ?? 6));

  const otherCounts = allocate(
    others.map((m) => Math.sqrt(m.population)),
    OTHER_MUNICIPALITY_SENSORS,
  );
  others.forEach((m, idx) => {
    const spread = 3 + Math.sqrt(m.population) / 3;
    for (let i = 0; i < (otherCounts[idx] ?? 0); i++) {
      const p = scatter(m, spread);
      placed.push({ ...p, urban: m.population >= 40 });
    }
  });

  for (let i = 0; i < LAPLAND_SPARSE_SENSORS; i++) placed.push(uniform(LAPLAND_MIN_LAT, 90));
  while (placed.length < total) placed.push(uniform(-90, LAPLAND_MIN_LAT));
  if (placed.length > total) placed.length = total;

  // Exact status mix, deterministically shuffled.
  const statuses: SensorStatus[] = [];
  for (const [status, share] of STATUS_SHARE)
    for (let i = 0; i < Math.round(total * share); i++) statuses.push(status);
  while (statuses.length < total) statuses.push('ONLINE');
  rng.shuffle(statuses);

  // ── Sites: k seed points per municipality, members join the nearest seed ────────────
  const byMunicipality = new Map<string, number[]>();
  placed.forEach((p, i) => {
    const list = byMunicipality.get(p.municipality.name) ?? [];
    list.push(i);
    byMunicipality.set(p.municipality.name, list);
  });

  const sites: FixtureSite[] = [];
  const siteOf: number[] = new Array<number>(placed.length).fill(-1);
  const municipalityNames = [...byMunicipality.keys()].sort((a, b) => a.localeCompare(b, 'fi'));
  for (const name of municipalityNames) {
    const members = byMunicipality.get(name) ?? [];
    const muni = (placed[members[0] ?? 0] as Placed).municipality;
    const districts = muni.districts ?? GENERIC_DISTRICTS;
    const k = Math.max(1, Math.min(districts.length, Math.ceil(members.length / 12)));
    const seeds = members.slice(0, k).map((i) => placed[i] as Placed);
    const firstSite = sites.length;
    seeds.forEach((_, s) => {
      sites.push({
        id: `SITE-${pad(sites.length + 1, 4)}`,
        name: `${muni.name} – ${districts[s] ?? `Alue ${s + 1}`}`,
        municipality: muni.name,
        region: muni.region,
        lat: 0,
        lon: 0,
        sensorCount: 0,
      });
    });
    for (const i of members) {
      const p = placed[i] as Placed;
      let best = 0;
      let bestKm = Infinity;
      seeds.forEach((s, idx) => {
        const km = distanceKm(p.lat, p.lon, s.lat, s.lon);
        if (km < bestKm) {
          bestKm = km;
          best = idx;
        }
      });
      siteOf[i] = firstSite + best;
    }
  }

  // ── Sensors ──────────────────────────────────────────────────────────────────────
  const perSiteSeq = new Map<number, number>();
  const installStart = Date.UTC(2021, 2, 1);
  const installEnd = Date.UTC(2025, 8, 30);
  const sensors: FixtureSensor[] = placed.map((p, i) => {
    const status = statuses[i] as SensorStatus;
    const type = rng.weighted(p.urban ? URBAN_TYPES : RURAL_TYPES);
    const siteIdx = siteOf[i] as number;
    const site = sites[siteIdx] as FixtureSite;
    const seq = (perSiteSeq.get(siteIdx) ?? 0) + 1;
    perSiteSeq.set(siteIdx, seq);
    site.sensorCount++;
    site.lat += p.lat;
    site.lon += p.lon;
    const district = site.name.split(' – ')[1] ?? site.municipality;
    const installedAt = new Date(
      Math.floor(rng.range(installStart, installEnd) / 3_600_000) * 3_600_000,
    ).toISOString();
    const batteryPct =
      status === 'LOW_BATTERY'
        ? rng.int(3, 14)
        : status === 'OFFLINE'
          ? rng.int(15, 90)
          : rng.int(35, 100);
    const lastSeenSecondsAgo =
      status === 'OFFLINE' ? rng.int(3 * 3600, 14 * 86400) : rng.int(5, 120);
    return {
      id: `FIQ-${pad(i + 1, 5)}`,
      name: `${district} ${TYPE_LABEL[type]} ${pad(seq, 2)}`,
      type,
      status,
      lat: round5(p.lat),
      lon: round5(p.lon),
      municipality: p.municipality.name,
      region: p.municipality.region,
      siteId: site.id,
      siteName: site.name,
      installedAt,
      batteryPct,
      firmware: rng.weighted(FIRMWARE),
      lastSeenSecondsAgo,
    };
  });
  for (const site of sites) {
    site.lat = round5(site.lat / Math.max(site.sensorCount, 1));
    site.lon = round5(site.lon / Math.max(site.sensorCount, 1));
  }

  // ── Alerts ───────────────────────────────────────────────────────────────────────
  const alerts: FixtureAlert[] = [];
  const addAlert = (a: Omit<FixtureAlert, 'id'>) =>
    alerts.push({ id: `ALR-${pad(alerts.length + 1, 5)}`, ...a });
  for (const s of sensors) {
    if (s.status === 'ALERT') {
      const critical = rng.next() < 0.35;
      addAlert({
        sensorId: s.id,
        severity: critical ? 'CRITICAL' : 'WARNING',
        message: thresholdMessage(s.type, rng, critical),
        createdSecondsAgo: rng.int(60, 48 * 3600),
        resolvedSecondsAgo: null,
      });
    } else if (s.status === 'LOW_BATTERY') {
      addAlert({
        sensorId: s.id,
        severity: 'WARNING',
        message: `Battery at ${s.batteryPct}% — schedule a replacement`,
        createdSecondsAgo: rng.int(3600, 7 * 86400),
        resolvedSecondsAgo: null,
      });
    } else if (s.status === 'OFFLINE') {
      const hours = Math.floor(s.lastSeenSecondsAgo / 3600);
      addAlert({
        sensorId: s.id,
        severity: hours > 72 ? 'CRITICAL' : 'WARNING',
        message: `No data received for ${hours} h`,
        createdSecondsAgo: Math.max(60, s.lastSeenSecondsAgo - 3 * 3600),
        resolvedSecondsAgo: null,
      });
    }
  }
  for (let i = 0; i < 400; i++) {
    const s = rng.pick(sensors);
    const created = rng.int(2 * 86400, 30 * 86400);
    addAlert({
      sensorId: s.id,
      severity: rng.next() < 0.25 ? 'CRITICAL' : 'WARNING',
      message: thresholdMessage(s.type, rng, false),
      createdSecondsAgo: created,
      resolvedSecondsAgo: created - rng.int(600, 86400),
    });
  }

  return {
    version: 1,
    seed,
    generatedBy: 'shared/scripts/generate-sensors.ts',
    counts: {
      sensors: sensors.length,
      sites: sites.length,
      alerts: alerts.length,
      activeAlerts: alerts.filter((a) => a.resolvedSecondsAgo === null).length,
    },
    sites,
    sensors,
    alerts,
  };
}

function thresholdMessage(type: SensorType, rng: Rng, critical: boolean): string {
  const bump = critical ? 1.6 : 1;
  switch (type) {
    case 'TEMPERATURE':
      return `Temperature ${(30 + rng.range(0.5, 5) * bump).toFixed(1)} °C exceeds the 30 °C threshold`;
    case 'HUMIDITY':
      return `Humidity ${Math.min(100, Math.round(90 + rng.range(1, 6) * bump))} % exceeds the 90 % threshold`;
    case 'NOISE':
      return `Noise level ${Math.round(85 + rng.range(1, 8) * bump)} dB exceeds the 85 dB threshold`;
    case 'AIR_QUALITY_PM25':
    case 'MULTI':
      return `PM2.5 ${(25 + rng.range(1, 30) * bump).toFixed(1)} µg/m³ exceeds the 25 µg/m³ threshold`;
  }
}

/**
 * Serialises with one record per line so diffs of the committed fixture stay readable.
 */
export function serializeFixture(f: Fixture): string {
  const block = (items: readonly unknown[]) =>
    items.map((x) => `    ${JSON.stringify(x)}`).join(',\n');
  return [
    '{',
    `  "version": ${f.version},`,
    `  "seed": ${f.seed},`,
    `  "generatedBy": ${JSON.stringify(f.generatedBy)},`,
    `  "counts": ${JSON.stringify(f.counts)},`,
    `  "sites": [\n${block(f.sites)}\n  ],`,
    `  "sensors": [\n${block(f.sensors)}\n  ],`,
    `  "alerts": [\n${block(f.alerts)}\n  ]`,
    '}',
    '',
  ].join('\n');
}

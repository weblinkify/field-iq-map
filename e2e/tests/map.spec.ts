import { expect, test } from '@playwright/test';
import {
  drawBBox,
  HELSINKI,
  jumpTo,
  MODE,
  openMap,
  parseCount,
  sensorLngLat,
  toPagePoint,
  waitForIdle,
} from './map-helpers';

const SENSOR = 'FIQ-00042';
const DECIMALS: Record<string, number> = { TEMPERATURE: 1, HUMIDITY: 0, NOISE: 0, PM25: 1 };

test.describe(`FieldIQ map (${MODE} API)`, () => {
  test('loads all 4,000 sensors with Finland in view', async ({ page }) => {
    await openMap(page);
    await expect(page.getByTestId('mode-badge')).toHaveText(MODE === 'real' ? 'LIVE API' : 'MOCK API');
    await expect(page.getByTestId('kpi-total')).toContainText('4,000');
    await expect(page.getByTestId('visible-count')).toContainText('Showing 4,000 of 4,000 sensors');

    const view = await page.evaluate(() => {
      const m = window.__fieldiq!.map;
      const b = m.getBounds();
      return { zoom: m.getZoom(), w: b.getWest(), s: b.getSouth(), e: b.getEast(), n: b.getNorth() };
    });
    // Finland's extent is 19.5–31.6 E, 59.8–70.1 N.
    expect(view.w).toBeLessThan(21);
    expect(view.e).toBeGreaterThan(30);
    expect(view.s).toBeLessThan(60);
    expect(view.n).toBeGreaterThan(70);
    expect(view.zoom).toBeGreaterThan(3);
  });

  test('hovering a sensor shows its id, value and status', async ({ page, request }) => {
    const latest = async () => {
      const detail = (await (await request.get(`/api/v1/sensors/${SENSOR}`)).json()) as {
        status: string;
        type: string;
        latestReadings: { metric: string; value: number; unit: string }[];
      };
      const primary = detail.type === 'MULTI' || detail.type === 'AIR_QUALITY_PM25' ? 'PM25' : detail.type;
      const r = detail.latestReadings.find((x) => x.metric === primary);
      return { status: detail.status, value: r ? `${r.value.toFixed(DECIMALS[r.metric])} ${r.unit}` : '—' };
    };
    const before = await latest();
    await openMap(page);
    const ll = await sensorLngLat(page, SENSOR);
    await jumpTo(page, ll, 15);
    const p = await toPagePoint(page, ll);
    await page.mouse.move(p.x, p.y);

    const tooltip = page.getByTestId('map-tooltip');
    await expect(tooltip).toBeVisible();
    await expect(page.getByTestId('tooltip-id')).toContainText(SENSOR);
    const statusLabel = { ONLINE: 'Online', ALERT: 'Alert', OFFLINE: 'Offline', LOW_BATTERY: 'Low battery' }[
      before.status
    ];
    await expect(page.getByTestId('tooltip-status')).toHaveText(statusLabel ?? before.status);
    const after = await latest();
    // Values move with time (simulator / time-based model): accept either side of the hover.
    expect([before.value, after.value]).toContain((await page.getByTestId('tooltip-value').innerText()).trim());
  });

  test('clicking a cluster zooms in and clicking a sensor opens its details', async ({ page }) => {
    await openMap(page);
    const zoomBefore = await page.evaluate(() => window.__fieldiq!.map.getZoom());
    const cluster = await page.evaluate(() => {
      const features = window.__fieldiq!.map.queryRenderedFeatures({ layers: ['clusters'] });
      features.sort((a, b) => Number(b.properties?.['point_count']) - Number(a.properties?.['point_count']));
      return features[0]?.geometry.coordinates ?? null;
    });
    expect(cluster).not.toBeNull();
    const cp = await toPagePoint(page, cluster as [number, number]);
    await page.mouse.click(cp.x, cp.y);
    await page.waitForFunction((z) => window.__fieldiq!.map.getZoom() > z + 0.5, zoomBefore);
    await waitForIdle(page);

    const ll = await sensorLngLat(page, SENSOR);
    await jumpTo(page, ll, 15);
    const sp = await toPagePoint(page, ll);
    await page.mouse.click(sp.x, sp.y);
    await expect(page).toHaveURL(new RegExp(`sensor=${SENSOR}`));
    await expect(page.getByTestId('sensor-detail')).toBeVisible();
    await expect(page.getByTestId('detail-id')).toHaveText(SENSOR);
  });

  test('bounding box over Helsinki matches the REST count for the same box', async ({ page, request }) => {
    await openMap(page);
    await jumpTo(page, [24.95, 60.22], 9.5);
    await drawBBox(page, HELSINKI.nw, HELSINKI.se);

    await expect(page).toHaveURL(/bbox=/);
    const bbox = new URL(page.url()).searchParams.get('bbox');
    expect(bbox).not.toBeNull();
    const rest = (await (await request.get(`/api/v1/sensors.geojson?bbox=${bbox}`)).json()) as {
      features: unknown[];
    };
    expect(rest.features.length).toBeGreaterThan(300);
    await expect(page.getByTestId('area-total')).toHaveText(rest.features.length.toLocaleString('en-US'));

    // The CSV export uses the same box.
    const href = await page.getByTestId('export-csv').getAttribute('href');
    const csv = await (await request.get(href ?? '')).text();
    expect(csv.trim().split('\r\n')).toHaveLength(rest.features.length + 1);
  });

  test('filters change the visible feature count', async ({ page, request }) => {
    await openMap(page);
    await page.getByTestId('filter-type-NOISE').click();
    const noise = (await (await request.get('/api/v1/sensors.geojson?type=NOISE')).json()) as { features: unknown[] };
    await expect(page.getByTestId('visible-count')).toContainText(
      `Showing ${noise.features.length.toLocaleString('en-US')} of 4,000`,
    );
    expect(await page.evaluate(() => window.__fieldiq!.visibleCount())).toBe(noise.features.length);

    await page.getByTestId('filter-status-ALERT').click();
    const both = (await (await request.get('/api/v1/sensors.geojson?type=NOISE&status=ALERT')).json()) as {
      features: unknown[];
    };
    await expect(page.getByTestId('visible-count')).toContainText(`Showing ${both.features.length} of 4,000`);
    expect(both.features.length).toBeLessThan(noise.features.length);
    await expect(page).toHaveURL(/types=NOISE/);
    await expect(page).toHaveURL(/statuses=ALERT/);
    expect(parseCount(await page.getByTestId('visible-count').innerText())).toBeGreaterThan(0);
  });

  test('region filter from a shared link (?regions=Keski-Pohjanmaa)', async ({ page, request }) => {
    await openMap(page, '/map?regions=Keski-Pohjanmaa');
    const rest = (await (await request.get('/api/v1/sensors.geojson?region=Keski-Pohjanmaa')).json()) as {
      features: unknown[];
    };
    expect(rest.features.length).toBeGreaterThan(0);
    await expect(page.getByTestId('visible-count')).toContainText(`Showing ${rest.features.length} of 4,000`);
    await expect(page.getByTestId('filter-region')).toHaveValue('Keski-Pohjanmaa');
  });

  test('deep link /map?sensor=FIQ-00042 opens the detail panel directly', async ({ page }) => {
    await openMap(page, `/map?sensor=${SENSOR}`);
    await expect(page.getByTestId('sensor-detail')).toBeVisible();
    await expect(page.getByTestId('detail-id')).toHaveText(SENSOR);
    await expect(page.getByRole('heading', { level: 2 })).not.toHaveText('');
    await expect(page.getByText('Last 24 hours')).toBeVisible();
    // The map flies to the sensor.
    await page.waitForFunction(() => window.__fieldiq!.map.getZoom() > 10);
  });

  test('switching dark/light basemap keeps the sensor layers', async ({ page }) => {
    await openMap(page);
    const errors: string[] = [];
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    const clusters = () =>
      page.evaluate(() => window.__fieldiq!.map.queryRenderedFeatures({ layers: ['clusters'] }).length);
    expect(await clusters()).toBeGreaterThan(0);
    for (const label of ['Light basemap', 'Dark basemap']) {
      await page.getByRole('button', { name: label }).click();
      await waitForIdle(page);
      await expect.poll(clusters).toBeGreaterThan(0);
    }
    expect(errors).toEqual([]);
  });

  test('keyboard users can reach sensor tooltips', async ({ page }) => {
    await openMap(page);
    const ll = await sensorLngLat(page, SENSOR);
    await jumpTo(page, ll, 13);
    await page.locator('canvas.maplibregl-canvas, canvas.mapboxgl-canvas').focus();
    await page.keyboard.press('n');
    await expect(page.getByTestId('map-tooltip')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('map-tooltip')).toBeHidden();
  });
});

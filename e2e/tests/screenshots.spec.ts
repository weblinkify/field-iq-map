/**
 * README media (run on demand: `npm run screenshots` against a stack with BASEMAP=openfreemap).
 * Writes docs/screenshots/*.png and docs/screenshots/fieldiq-map.gif.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import gifenc from 'gifenc';
import { PNG } from 'pngjs';

const { applyPalette, GIFEncoder, quantize } = gifenc;
import { drawBBox, HELSINKI, jumpTo, openMap, sensorLngLat, toPagePoint, waitForIdle } from './map-helpers';

const OUT = new URL('../../docs/screenshots/', import.meta.url).pathname;

test.skip(!process.env['SCREENSHOTS'], 'set SCREENSHOTS=1 to regenerate README media');
test.setTimeout(240_000);

async function shot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: `${OUT}${name}.png` });
}

test('README screenshots @screenshots', async ({ page }) => {
  mkdirSync(OUT, { recursive: true });
  await openMap(page);
  await page.waitForTimeout(2500); // basemap tiles
  await shot(page, 'map-clusters');

  const ll = await sensorLngLat(page, 'FIQ-00042');
  await jumpTo(page, ll, 14.5);
  await page.waitForTimeout(2000);
  const p = await toPagePoint(page, ll);
  await page.mouse.move(p.x, p.y);
  await expect(page.getByTestId('map-tooltip')).toBeVisible();
  await shot(page, 'tooltip');

  await page.mouse.click(p.x, p.y);
  await expect(page.getByTestId('sensor-detail')).toBeVisible();
  await page.waitForTimeout(1500);
  await shot(page, 'sensor-detail');

  await openMap(page);
  await jumpTo(page, [24.95, 60.22], 9.5);
  await page.waitForTimeout(2000);
  await drawBBox(page, HELSINKI.nw, HELSINKI.se);
  await expect(page.getByTestId('area-total')).not.toHaveText('');
  await page.waitForTimeout(1500);
  await shot(page, 'bbox-selection');

  await openMap(page, '/map?layer=heatmap');
  await jumpTo(page, [25.2, 61.2], 6);
  await page.waitForTimeout(2500);
  await shot(page, 'pm25-heatmap');

  await page.goto('/dashboard');
  await page.waitForSelector('table');
  await page.waitForTimeout(800);
  await shot(page, 'dashboard');
});

test('README animated tour @screenshots', async ({ page }) => {
  mkdirSync(OUT, { recursive: true });
  await page.setViewportSize({ width: 1100, height: 680 });
  const gif = GIFEncoder();
  const frame = async (repeat = 1, delay = 120) => {
    const png = PNG.sync.read(await page.screenshot());
    const palette = quantize(png.data, 128);
    const index = applyPalette(png.data, palette);
    for (let i = 0; i < repeat; i++) gif.writeFrame(index, png.width, png.height, { palette, delay });
  };

  await openMap(page);
  await page.waitForTimeout(2500);
  await frame(8);

  // Zoom from Finland into Helsinki.
  for (const [center, zoom] of [
    [[25.5, 63.5], 5.2],
    [[25.0, 61.5], 6.5],
    [[24.95, 60.4], 8],
    [[24.95, 60.22], 9.5],
  ] as [[number, number], number][]) {
    await jumpTo(page, center, zoom);
    await page.waitForTimeout(900);
    await frame(3);
  }

  // Draw a selection over Helsinki in a few visible steps.
  // Smaller box than the test fixture so it stays clear of the overlays at this viewport.
  const a = await toPagePoint(page, [24.84, 60.26]);
  const b = await toPagePoint(page, [25.12, 60.16]);
  await page.keyboard.down('Shift');
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  for (const t of [0.25, 0.5, 0.75, 1]) {
    await page.mouse.move(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, { steps: 3 });
    await frame(1, 160);
  }
  await page.mouse.up();
  await page.keyboard.up('Shift');
  await expect(page.getByTestId('area-total')).not.toHaveText('');
  await page.waitForTimeout(1200);
  await frame(12);

  // Close the panel, zoom to a sensor and hover it.
  await page.getByRole('button', { name: 'Clear selection' }).click();
  const ll = await sensorLngLat(page, 'FIQ-00042');
  await jumpTo(page, ll, 14.5);
  await page.waitForTimeout(1800);
  await waitForIdle(page);
  const p = await toPagePoint(page, ll);
  await page.mouse.move(p.x - 40, p.y - 30);
  await frame(2);
  await page.mouse.move(p.x, p.y, { steps: 4 });
  await expect(page.getByTestId('map-tooltip')).toBeVisible();
  await frame(12);
  await page.mouse.click(p.x, p.y);
  await expect(page.getByTestId('sensor-detail')).toBeVisible();
  await page.waitForTimeout(1500);
  await frame(16);

  gif.finish();
  writeFileSync(`${OUT}fieldiq-map.gif`, gif.bytes());
});

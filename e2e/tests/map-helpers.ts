import { expect, type Page } from '@playwright/test';

/** Shape of window.__fieldiq (exposed only by non-production builds). */
interface TestHookMap {
  loaded(): boolean;
  getZoom(): number;
  getBounds(): { getWest(): number; getSouth(): number; getEast(): number; getNorth(): number };
  project(lngLat: [number, number]): { x: number; y: number };
  jumpTo(options: { center: [number, number]; zoom: number }): void;
  queryRenderedFeatures(options: { layers: string[] }): {
    properties: Record<string, unknown> | null;
    geometry: { coordinates: [number, number] };
  }[];
  isMoving(): boolean;
}

declare global {
  interface Window {
    __fieldiq?: {
      map: TestHookMap;
      engine: string;
      ready: boolean;
      totalCount(): number;
      visibleCount(): number;
      sensorLngLat(id: string): [number, number] | null;
    };
  }
}

export const MODE = (process.env['E2E_MODE'] ?? 'mock') as 'mock' | 'real';
export const HELSINKI: { nw: [number, number]; se: [number, number] } = {
  nw: [24.7, 60.33],
  se: [25.2, 60.12],
};

/** Opens a page and waits until all 4,000 sensors are loaded and the map is idle. */
export async function openMap(page: Page, path = '/map'): Promise<void> {
  await page.goto(path);
  await page.waitForFunction(() => (window.__fieldiq?.totalCount() ?? 0) > 0, null, { timeout: 60_000 });
  await waitForIdle(page);
}

export async function waitForIdle(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const m = window.__fieldiq?.map;
    return !!m && m.loaded() && !m.isMoving();
  });
  // Give the clustered source a frame to settle after setData.
  await page.waitForTimeout(300);
}

export async function jumpTo(page: Page, center: [number, number], zoom: number): Promise<void> {
  await page.evaluate(([c, z]) => window.__fieldiq?.map.jumpTo({ center: c, zoom: z }), [center, zoom] as const);
  await waitForIdle(page);
}

/** Converts a lng/lat to page pixels using map.project(). */
export async function toPagePoint(page: Page, lngLat: [number, number]): Promise<{ x: number; y: number }> {
  const box = await page.getByTestId('map').boundingBox();
  expect(box).not.toBeNull();
  const p = await page.evaluate((ll) => window.__fieldiq!.map.project(ll), lngLat);
  return { x: (box?.x ?? 0) + p.x, y: (box?.y ?? 0) + p.y };
}

export async function sensorLngLat(page: Page, id: string): Promise<[number, number]> {
  const ll = await page.evaluate((sid) => window.__fieldiq?.sensorLngLat(sid) ?? null, id);
  expect(ll, `sensor ${id} on the map`).not.toBeNull();
  return ll as [number, number];
}

/** Shift+drag a rectangle between two coordinates. */
export async function drawBBox(page: Page, a: [number, number], b: [number, number]): Promise<void> {
  const p1 = await toPagePoint(page, a);
  const p2 = await toPagePoint(page, b);
  await page.keyboard.down('Shift');
  await page.mouse.move(p1.x, p1.y);
  await page.mouse.down();
  await page.mouse.move((p1.x + p2.x) / 2, (p1.y + p2.y) / 2, { steps: 5 });
  await page.mouse.move(p2.x, p2.y, { steps: 5 });
  await page.mouse.up();
  await page.keyboard.up('Shift');
}

export const parseCount = (text: string): number => Number(text.replace(/[^\d]/g, ''));

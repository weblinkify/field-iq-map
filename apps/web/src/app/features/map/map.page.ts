import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  type ElementRef,
  inject,
  NgZone,
  signal,
  untracked,
  viewChild,
  type AfterViewInit,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { map, startWith, switchMap, timer } from 'rxjs';
import { SensorsRestService, type BBox } from '../../api/rest/sensors-rest.service';
import { formatCount } from '../../core/format';
import { Icon } from '../../shared/icon';
import { RUNTIME_CONFIG } from '../../core/runtime-config';
import { environment } from '../../../environments/environment';
import { FINLAND_BOUNDS } from './engine/styles';
import type { GlMap } from './engine/gl-map';
import { MAP_ENGINE } from './engine/map-engine.provider';
import { MapController, type HoverState } from './map-controller';
import { toMapFeatures, type MapFeatureCollection } from './state/features';
import { buildFilterExpression, matchesFilter, type MapFilter } from './state/map-filter';
import { tooltipText } from './state/tooltip';
import { parseUrlState, toQueryParams, type LayerMode, type MapUrlState } from './state/url-state';
import { AreaStatsPanel } from './ui/area-stats-panel';
import { FilterBar } from './ui/filter-bar';
import { MapLegend } from './ui/map-legend';
import { MapTooltip } from './ui/map-tooltip';
import { SensorDetailPanel } from './ui/sensor-detail-panel';

/** Test hook (non-production builds only) used by Playwright to locate features in pixels. */
export interface FieldIqTestHook {
  map: GlMap;
  engine: string;
  ready: boolean;
  totalCount(): number;
  visibleCount(): number;
  sensorLngLat(id: string): [number, number] | null;
}

declare global {
  interface Window {
    __fieldiq?: FieldIqTestHook;
  }
}

/** Refresh interval for map data; unchanged data costs a 304 thanks to ETags. */
const REFRESH_MS = 60_000;

@Component({
  selector: 'app-map-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MapTooltip, SensorDetailPanel, MapLegend, FilterBar, AreaStatsPanel, Icon],
  host: { class: 'absolute inset-0', '(document:keydown.escape)': 'cancelSelect()' },
  template: `
    <div class="relative flex h-full overflow-hidden">
      <h1 class="sr-only">Sensor map</h1>
      <p id="map-keyboard-help" class="sr-only">
        Focus the map, then press N or P to move between visible sensors and clusters, Enter to
        open, Escape to clear.
      </p>
      <div class="relative min-w-0 flex-1">
        <div #mapContainer class="absolute inset-0" data-testid="map"></div>

        @if (hover(); as h) {
          <app-map-tooltip [state]="h" [containerWidth]="containerWidth()" />
        }
        <div class="sr-only" aria-live="polite">{{ hoverText() }}</div>

        <div class="absolute bottom-3 left-3 z-10 hidden sm:block">
          <app-map-legend
            [mode]="state().layer"
            [dark]="dark()"
            (modeChange)="setLayer($event)"
            (darkChange)="setDark($event)"
          />
        </div>

        <div
          class="pointer-events-none absolute inset-x-3 top-3 z-10 flex flex-wrap items-start justify-between gap-2"
        >
          <div class="pointer-events-auto flex max-w-full flex-col items-start gap-2">
            <app-filter-bar [filter]="state().filter" (changed)="setFilter($event)" />
            <p
              class="rounded-md bg-ink-900/90 px-2.5 py-1 text-xs text-slate-300 ring-1 ring-slate-700"
              data-testid="visible-count"
              aria-live="polite"
            >
              Showing {{ count(visibleCount()) }} of {{ count(totalCount()) }} sensors
            </p>
          </div>
          <div class="pointer-events-auto flex gap-2 text-xs">
            @if (searchAreaVisible()) {
              <button
                type="button"
                class="flex items-center gap-1.5 rounded-lg bg-indigo-500 px-3 py-2 font-medium text-white shadow-lg hover:bg-indigo-400"
                data-testid="search-area"
                (click)="searchThisArea()"
              >
                <app-icon name="search" [size]="14" /> Search this area
              </button>
            }
            <button
              type="button"
              class="flex items-center gap-1.5 rounded-lg px-3 py-2 font-medium shadow-lg ring-1"
              [class]="
                selectMode()
                  ? 'bg-indigo-500 text-white ring-indigo-300'
                  : 'bg-ink-900/90 text-slate-200 ring-slate-700 hover:bg-slate-800'
              "
              [attr.aria-pressed]="selectMode()"
              data-testid="select-area"
              title="Draw a rectangle (or hold Shift and drag)"
              (click)="toggleSelect()"
            >
              <app-icon name="select" [size]="14" />
              {{ selectMode() ? 'Drag to select…' : 'Select area' }}
            </button>
          </div>
        </div>

        @if (error(); as e) {
          <p
            role="alert"
            class="absolute inset-x-0 top-14 mx-auto w-fit rounded-md bg-red-500/20 px-3 py-2 text-sm text-red-200"
          >
            {{ e }}
          </p>
        }
        @if (!ready()) {
          <p role="status" class="absolute inset-0 grid place-items-center text-slate-400">
            Loading map…
          </p>
        }
      </div>

      @if (state().sensor; as id) {
        <div class="absolute inset-y-0 right-0 z-30 w-full sm:static sm:w-auto">
          <app-sensor-detail-panel [sensorId]="id" (closed)="selectSensor(null)" />
        </div>
      } @else if (state().bbox; as bbox) {
        <div class="absolute inset-y-0 right-0 z-30 w-full sm:static sm:w-auto">
          <app-area-stats-panel
            [bbox]="bbox"
            [filter]="state().filter"
            (cleared)="setBBox(null)"
            (zoomTo)="zoomToSelection()"
            (sensorSelected)="selectSensor($event)"
          />
        </div>
      }
    </div>
  `,
})
export class MapPage implements AfterViewInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly rest = inject(SensorsRestService);
  private readonly engine = inject(MAP_ENGINE);
  private readonly config = inject(RUNTIME_CONFIG);
  private readonly zone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);
  private readonly container = viewChild.required<ElementRef<HTMLDivElement>>('mapContainer');

  protected readonly state = toSignal(this.route.queryParamMap.pipe(map(parseUrlState)), {
    requireSync: true,
  });
  protected readonly hover = signal<HoverState | null>(null);
  protected readonly dark = signal(true);
  protected readonly ready = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly containerWidth = signal(1024);
  protected readonly selectMode = signal(false);
  protected readonly searchAreaVisible = signal(false);
  private initialFitDone = false;
  private readonly controller = signal<MapController | null>(null);
  private readonly all = signal<MapFeatureCollection | null>(null);
  private flownTo: string | null = null;

  /** Features matching the filters — fed to the clustered source. */
  private readonly filtered = computed<MapFeatureCollection | null>(() => {
    const all = this.all();
    if (!all) return null;
    const f = this.state().filter;
    return {
      type: 'FeatureCollection',
      features: all.features.filter((x) => matchesFilter(x.properties, f)),
    };
  });
  protected readonly totalCount = computed(() => this.all()?.features.length ?? 0);
  protected readonly visibleCount = computed(() => this.filtered()?.features.length ?? 0);
  protected readonly hoverText = computed(() => {
    const h = this.hover();
    return h?.keyboard ? tooltipText(h.tooltip) : '';
  });
  protected readonly count = formatCount;

  constructor() {
    effect(() => {
      const c = this.controller();
      const all = this.all();
      const filtered = this.filtered();
      if (c && all && filtered) {
        c.setSensors(filtered, all);
        c.setFilter(buildFilterExpression(this.state().filter));
      }
    });
    effect(() => this.controller()?.setMode(this.state().layer));
    effect(() => this.controller()?.setSelection(this.state().bbox));
    // Deep link: fly to ?sensor=… once the data is there (not on every refresh or click).
    effect(() => {
      const id = this.state().sensor;
      const c = this.controller();
      const all = this.all();
      if (!id || !c || !all || id === this.flownTo) return;
      const f = all.features.find((x) => x.properties.id === id);
      if (f) {
        this.flownTo = id;
        untracked(() => c.flyTo(f.geometry.coordinates[0], f.geometry.coordinates[1]));
      }
    });
  }

  async ngAfterViewInit(): Promise<void> {
    const el = this.container().nativeElement;
    try {
      const gl = await this.engine.create({
        container: el,
        bounds: FINLAND_BOUNDS,
        padding: 32,
        dark: this.dark(),
        basemap: this.config.basemap,
        mapboxToken: this.config.mapboxToken,
      });
      const controller = new MapController(
        gl,
        this.engine,
        this.engine.fontStack(this.config.basemap),
        `${location.origin}/geo/finland.geojson`,
        {
          hover: (h) => this.zone.run(() => this.onHover(h)),
          sensorSelected: (id) => this.zone.run(() => this.selectSensor(id, false)),
          bboxChanged: (b, final) => final && this.zone.run(() => this.setBBox(b)),
          selectModeEnded: () => this.zone.run(() => this.selectMode.set(false)),
          moved: () => this.zone.run(() => this.onMoved()),
        },
      );
      controller.init();
      const initialBBox = this.state().bbox;
      if (initialBBox) controller.fitBBox(initialBBox);
      this.destroyRef.onDestroy(() => {
        controller.destroy();
        if (window.__fieldiq?.map === gl) delete window.__fieldiq;
      });
      this.controller.set(controller);
      this.loadData();
      this.exposeTestHook(gl);
    } catch (e) {
      this.error.set(`The map could not be created: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  private loadData(): void {
    const sub = timer(0, REFRESH_MS)
      .pipe(
        switchMap(() => this.rest.geojson()),
        map(toMapFeatures),
        startWith(null),
      )
      .subscribe({
        next: (fc) => {
          if (!fc) return;
          this.all.set(fc);
          this.ready.set(true);
          this.error.set(null);
        },
        error: () => this.error.set('Sensor data could not be loaded. Is the API running?'),
      });
    this.destroyRef.onDestroy(() => sub.unsubscribe());
  }

  private onHover(h: HoverState | null): void {
    this.containerWidth.set(this.container().nativeElement.clientWidth);
    this.hover.set(h);
  }

  // ── URL-backed state ────────────────────────────────────────────────────────────────────
  protected selectSensor(id: string | null, fly = true): void {
    if (!fly && id) this.flownTo = id;
    this.navigate({ sensor: id });
  }

  protected setFilter(filter: MapFilter): void {
    this.navigate({ filter });
  }

  protected setBBox(bbox: BBox | null): void {
    this.searchAreaVisible.set(false);
    this.navigate({ bbox, sensor: bbox ? null : this.state().sensor });
  }

  protected toggleSelect(): void {
    const on = !this.selectMode();
    this.selectMode.set(on);
    this.controller()?.setSelectMode(on);
  }

  protected cancelSelect(): void {
    if (!this.selectMode()) return;
    this.selectMode.set(false);
    this.controller()?.setSelectMode(false);
  }

  /** "Search this area": stats for the current viewport. */
  protected searchThisArea(): void {
    const c = this.controller();
    if (c) this.setBBox(c.viewportBBox());
  }

  protected zoomToSelection(): void {
    const b = this.state().bbox;
    if (b) this.controller()?.fitBBox(b);
  }

  private onMoved(): void {
    // The first moveend is the initial fit to Finland; afterwards offer a viewport search.
    if (!this.initialFitDone) {
      this.initialFitDone = true;
      return;
    }
    this.searchAreaVisible.set(true);
  }

  protected setLayer(layer: LayerMode): void {
    this.navigate({ layer });
  }

  protected async setDark(dark: boolean): Promise<void> {
    const c = this.controller();
    this.dark.set(dark);
    if (!c) return;
    await this.engine.setBasemap(c.map, dark, this.config.basemap);
    c.restoreAfterStyleChange();
  }

  private navigate(patch: Partial<MapUrlState>): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: toQueryParams({ ...this.state(), ...patch }),
      replaceUrl: patch.sensor === undefined,
    });
  }

  private exposeTestHook(gl: GlMap): void {
    if (!environment.testHooks) return;
    window.__fieldiq = {
      map: gl,
      engine: this.engine.kind,
      get ready() {
        return gl.loaded();
      },
      totalCount: () => this.totalCount(),
      visibleCount: () => this.visibleCount(),
      sensorLngLat: (id) => {
        const f = this.all()?.features.find((x) => x.properties.id === id);
        return f ? f.geometry.coordinates : null;
      },
    };
  }
}

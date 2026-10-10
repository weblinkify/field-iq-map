import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { combineLatest, map, switchMap } from 'rxjs';
import {
  AreaSensorsGQL,
  AreaStatsGQL,
  type AreaSensorsQuery,
  type AreaStatsQuery,
  type SensorFilter,
} from '../../../api/generated/graphql';
import { SensorsRestService, type BBox } from '../../../api/rest/sensors-rest.service';
import { formatCount, formatValue } from '../../../core/format';
import {
  METRIC_LABELS,
  STATUS_COLORS,
  STATUS_LABELS,
  TYPE_LABELS,
} from '../../../core/sensor-meta';
import { completeData } from '../../../shared/complete';
import { Icon } from '../../../shared/icon';
import { StatusBadge } from '../../../shared/status-badge';
import { isEmptyFilter, type MapFilter } from '../state/map-filter';

const PAGE_SIZE = 25;

export const toGraphQlFilter = (f: MapFilter): SensorFilter | null =>
  isEmptyFilter(f)
    ? null
    : {
        types: f.types.length ? [...f.types] : null,
        statuses: f.statuses.length ? [...f.statuses] : null,
        regions: f.regions.length ? [...f.regions] : null,
      };

/** Stats for the selected bounding box (GraphQL sensorStats) and a paginated sensor list. */
@Component({
  selector: 'app-area-stats-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, StatusBadge],
  template: `
    <aside
      class="flex h-full w-full flex-col overflow-y-auto border-l border-slate-800 bg-ink-900/95 backdrop-blur sm:w-96"
      aria-labelledby="area-stats-title"
      data-testid="area-stats"
    >
      <header class="flex items-start justify-between gap-3 border-b border-slate-800 p-4">
        <div>
          <h2 id="area-stats-title" class="text-lg font-semibold">Selected area</h2>
          <p class="font-mono text-xs text-slate-400">{{ bboxLabel() }}</p>
        </div>
        <button
          type="button"
          class="rounded-md p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
          aria-label="Clear selection"
          (click)="cleared.emit()"
        >
          <app-icon name="x" />
        </button>
      </header>

      <div class="flex flex-wrap gap-2 border-b border-slate-800 p-4 text-xs">
        <button
          type="button"
          class="flex items-center gap-1.5 rounded-md bg-slate-800 px-2.5 py-1.5 hover:bg-slate-700"
          (click)="zoomTo.emit()"
        >
          <app-icon name="focus" [size]="14" /> Zoom to selection
        </button>
        <a
          class="flex items-center gap-1.5 rounded-md bg-slate-800 px-2.5 py-1.5 hover:bg-slate-700"
          [href]="csvUrl()"
          download="fieldiq-sensors.csv"
          data-testid="export-csv"
        >
          <app-icon name="download" [size]="14" /> Export CSV
        </a>
        <button
          type="button"
          class="flex items-center gap-1.5 rounded-md bg-slate-800 px-2.5 py-1.5 hover:bg-slate-700"
          (click)="cleared.emit()"
        >
          <app-icon name="x" [size]="14" /> Clear
        </button>
      </div>

      @if (stats(); as s) {
        <section class="grid grid-cols-2 gap-3 p-4" aria-label="Summary">
          <div class="rounded-lg bg-slate-800/60 p-3">
            <p class="text-xs text-slate-400">Sensors</p>
            <p class="text-2xl font-semibold tabular-nums" data-testid="area-total">
              {{ count(s.total) }}
            </p>
          </div>
          <div class="rounded-lg bg-slate-800/60 p-3">
            <p class="text-xs text-slate-400">Active alerts</p>
            <p class="text-2xl font-semibold tabular-nums text-red-300">
              {{ count(s.activeAlerts) }}
            </p>
          </div>
          @for (a of s.averages; track a.metric) {
            @if (a.metric === 'TEMPERATURE' || a.metric === 'PM25') {
              <div class="rounded-lg bg-slate-800/60 p-3">
                <p class="text-xs text-slate-400">Avg {{ metricLabel[a.metric] }}</p>
                <p
                  class="text-lg font-semibold tabular-nums"
                  [attr.data-testid]="'area-avg-' + a.metric"
                >
                  {{ value(a.average, a.unit, a.metric) }}
                </p>
              </div>
            }
          }
        </section>

        <section class="px-4" aria-label="By status">
          <h3 class="mb-2 text-sm font-medium">By status</h3>
          <ul class="space-y-1 text-xs">
            @for (b of s.byStatus; track b.status) {
              <li class="flex items-center gap-2" [attr.data-testid]="'area-status-' + b.status">
                <span class="size-2 rounded-full" [style.background]="statusColor[b.status]"></span>
                <span class="flex-1">{{ statusLabel[b.status] }}</span>
                <span class="tabular-nums">{{ count(b.count) }}</span>
              </li>
            }
          </ul>
          <h3 class="mt-4 mb-2 text-sm font-medium">By type</h3>
          <ul class="space-y-1 text-xs">
            @for (t of s.byType; track t.type) {
              <li class="flex justify-between">
                <span>{{ typeLabel[t.type] }}</span
                ><span class="tabular-nums">{{ count(t.count) }}</span>
              </li>
            }
          </ul>
        </section>
      } @else {
        <p class="p-4 text-sm text-slate-400" role="status">Loading stats…</p>
      }

      <section class="mt-4 border-t border-slate-800 p-4" aria-label="Sensors in the area">
        <h3 class="mb-2 text-sm font-medium">Sensors</h3>
        @if (page(); as p) {
          <ul class="divide-y divide-slate-800 text-xs">
            @for (e of p.sensors.edges; track e.node.id) {
              <li>
                <button
                  type="button"
                  class="flex w-full items-center gap-2 py-2 text-left hover:bg-slate-800/50"
                  (click)="sensorSelected.emit(e.node.id)"
                >
                  <span class="flex-1">
                    <span class="block font-medium text-slate-100">{{ e.node.name }}</span>
                    <span class="font-mono text-slate-400"
                      >{{ e.node.id }} · {{ e.node.municipality }}</span
                    >
                  </span>
                  <app-status-badge [status]="e.node.status" />
                </button>
              </li>
            } @empty {
              <li class="py-2 text-slate-500">No sensors match.</li>
            }
          </ul>
          <div class="mt-2 flex items-center justify-between text-xs text-slate-400">
            <span>
              {{ cursors().length * pageSize + 1 }}–{{
                cursors().length * pageSize + p.sensors.edges.length
              }}
              of
              {{ count(p.sensors.totalCount) }}
            </span>
            <span class="flex gap-1">
              <button
                type="button"
                class="rounded border border-slate-700 px-2 py-1 disabled:opacity-40"
                [disabled]="cursors().length === 0"
                (click)="cursors.set(cursors().slice(0, -1))"
              >
                Previous
              </button>
              <button
                type="button"
                class="rounded border border-slate-700 px-2 py-1 disabled:opacity-40"
                [disabled]="!p.sensors.pageInfo.hasNextPage"
                (click)="next(p.sensors.pageInfo.endCursor)"
              >
                Next
              </button>
            </span>
          </div>
        }
      </section>
    </aside>
  `,
})
export class AreaStatsPanel {
  readonly bbox = input.required<BBox>();
  readonly filter = input.required<MapFilter>();
  readonly cleared = output<void>();
  readonly zoomTo = output<void>();
  readonly sensorSelected = output<string>();

  private readonly statsGql = inject(AreaStatsGQL);
  private readonly sensorsGql = inject(AreaSensorsGQL);
  private readonly rest = inject(SensorsRestService);
  protected readonly cursors = signal<string[]>([]);
  protected readonly pageSize = PAGE_SIZE;

  private readonly variables = computed(() => ({
    bbox: this.bbox(),
    filter: toGraphQlFilter(this.filter()),
  }));

  protected readonly stats = toSignal(
    toObservable(this.variables).pipe(
      switchMap((variables) =>
        this.statsGql.watch({ variables }).valueChanges.pipe(completeData<AreaStatsQuery>()),
      ),
      map((d) => d.sensorStats),
    ),
  );
  protected readonly page = toSignal(
    combineLatest([toObservable(this.variables), toObservable(this.cursors)]).pipe(
      switchMap(([v, cursors]) =>
        this.sensorsGql
          .watch({ variables: { ...v, first: PAGE_SIZE, after: cursors.at(-1) ?? null } })
          .valueChanges.pipe(completeData<AreaSensorsQuery>()),
      ),
    ),
  );

  protected readonly bboxLabel = computed(() => {
    const b = this.bbox();
    return `${b.minLat.toFixed(3)}, ${b.minLon.toFixed(3)} → ${b.maxLat.toFixed(3)}, ${b.maxLon.toFixed(3)}`;
  });
  protected readonly csvUrl = computed(() =>
    this.rest.csvExportUrl({ bbox: this.bbox(), ...this.filter() }),
  );

  protected readonly count = formatCount;
  protected readonly value = formatValue;
  protected readonly metricLabel = METRIC_LABELS;
  protected readonly statusLabel = STATUS_LABELS;
  protected readonly statusColor = STATUS_COLORS;
  protected readonly typeLabel = TYPE_LABELS;

  constructor() {
    // A new area or filter starts again at page 1.
    toObservable(this.variables).subscribe(() => {
      if (this.cursors().length) this.cursors.set([]);
    });
  }

  protected next(cursor: string | null): void {
    if (cursor) this.cursors.update((c) => [...c, cursor]);
  }
}

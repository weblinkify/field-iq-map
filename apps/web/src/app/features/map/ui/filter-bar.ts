import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import {
  RegionsGQL,
  type RegionsQuery,
  type SensorStatus,
  type SensorType,
} from '../../../api/generated/graphql';
import {
  SENSOR_STATUSES,
  SENSOR_TYPES,
  STATUS_COLORS,
  STATUS_LABELS,
  TYPE_LABELS,
} from '../../../core/sensor-meta';
import { completeData } from '../../../shared/complete';
import { isEmptyFilter, type MapFilter } from '../state/map-filter';

const toggle = <T>(list: readonly T[], item: T): T[] =>
  list.includes(item) ? list.filter((x) => x !== item) : [...list, item];

/** Type / status / region filters. Applied to the map layers and the stats. */
@Component({
  selector: 'app-filter-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form
      class="flex flex-wrap items-center gap-2 rounded-xl border border-slate-700 bg-ink-900/90 p-2 text-xs shadow-xl backdrop-blur"
      aria-label="Filter sensors"
      (submit)="$event.preventDefault()"
    >
      <fieldset class="flex flex-wrap items-center gap-1">
        <legend class="sr-only">Sensor type</legend>
        @for (t of types; track t) {
          <button
            type="button"
            class="rounded-full px-2.5 py-1 ring-1"
            [class]="
              filter().types.includes(t)
                ? 'bg-indigo-500 text-white ring-indigo-400'
                : 'bg-slate-800 text-slate-300 ring-slate-700 hover:bg-slate-700'
            "
            [attr.aria-pressed]="filter().types.includes(t)"
            [attr.data-testid]="'filter-type-' + t"
            (click)="changed.emit({ ...filter(), types: toggle(filter().types, t) })"
          >
            {{ typeLabel[t] }}
          </button>
        }
      </fieldset>
      <span class="mx-1 h-5 w-px bg-slate-700" aria-hidden="true"></span>
      <fieldset class="flex flex-wrap items-center gap-1">
        <legend class="sr-only">Status</legend>
        @for (s of statuses; track s) {
          <button
            type="button"
            class="flex items-center gap-1.5 rounded-full px-2.5 py-1 ring-1"
            [class]="
              filter().statuses.includes(s)
                ? 'bg-slate-100 text-ink-950 ring-white'
                : 'bg-slate-800 text-slate-300 ring-slate-700 hover:bg-slate-700'
            "
            [attr.aria-pressed]="filter().statuses.includes(s)"
            [attr.data-testid]="'filter-status-' + s"
            (click)="changed.emit({ ...filter(), statuses: toggle(filter().statuses, s) })"
          >
            <span class="size-2 rounded-full" [style.background]="color[s]"></span
            >{{ statusLabel[s] }}
          </button>
        }
      </fieldset>
      <span class="mx-1 h-5 w-px bg-slate-700" aria-hidden="true"></span>
      <label class="flex items-center gap-1 text-slate-300">
        Region
        <select
          class="rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-slate-100"
          data-testid="filter-region"
          [value]="filter().regions[0] ?? ''"
          (change)="setRegion($any($event.target).value)"
        >
          <option value="">All regions</option>
          @for (r of regions(); track r.region) {
            <option [value]="r.region">{{ r.region }} ({{ r.sensorCount }})</option>
          }
        </select>
      </label>
      @if (!empty()) {
        <button
          type="button"
          class="rounded-md px-2 py-1 text-indigo-300 hover:underline"
          (click)="changed.emit({ types: [], statuses: [], regions: [] })"
        >
          Clear filters
        </button>
      }
    </form>
  `,
})
export class FilterBar {
  readonly filter = input.required<MapFilter>();
  readonly changed = output<MapFilter>();

  protected readonly regions = toSignal(
    inject(RegionsGQL)
      .watch()
      .valueChanges.pipe(
        completeData<RegionsQuery>(),
        map((d) => d.regions),
      ),
    { initialValue: [] },
  );
  protected readonly empty = computed(() => isEmptyFilter(this.filter()));
  protected readonly types: readonly SensorType[] = SENSOR_TYPES;
  protected readonly statuses: readonly SensorStatus[] = SENSOR_STATUSES;
  protected readonly typeLabel = TYPE_LABELS;
  protected readonly statusLabel = STATUS_LABELS;
  protected readonly color = STATUS_COLORS;
  protected readonly toggle = toggle;

  protected setRegion(region: string): void {
    this.changed.emit({ ...this.filter(), regions: region ? [region] : [] });
  }
}

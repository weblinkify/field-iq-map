import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import {
  SENSOR_STATUSES,
  STATUS_COLORS,
  STATUS_LABELS,
  TYPE_GLYPHS,
  TYPE_LABELS,
  SENSOR_TYPES,
} from '../../../core/sensor-meta';
import { Icon } from '../../../shared/icon';
import { LAYER_MODES, type LayerMode } from '../state/url-state';

const MODE_LABELS: Record<LayerMode, string> = {
  clusters: 'Clusters',
  points: 'Points',
  heatmap: 'PM2.5 heatmap',
};

/** Legend, layer mode toggle and dark/light basemap switch. */
@Component({
  selector: 'app-map-legend',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  template: `
    <section
      class="w-60 rounded-xl border border-slate-700 bg-ink-900/90 p-3 text-xs shadow-xl backdrop-blur"
      aria-label="Map legend and layers"
    >
      <fieldset>
        <legend class="mb-1 flex items-center gap-1 font-medium text-slate-300">
          <app-icon name="layers" [size]="14" /> Layer
        </legend>
        <div class="grid grid-cols-3 gap-1" role="radiogroup">
          @for (m of modes; track m) {
            <button
              type="button"
              role="radio"
              [attr.aria-checked]="mode() === m"
              [attr.data-testid]="'layer-' + m"
              class="rounded-md px-1.5 py-1"
              [class]="
                mode() === m
                  ? 'bg-indigo-500 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              "
              (click)="modeChange.emit(m)"
            >
              {{ modeLabel[m] }}
            </button>
          }
        </div>
      </fieldset>

      <h3 class="mt-3 mb-1 font-medium text-slate-300">Status</h3>
      <ul class="grid grid-cols-2 gap-1">
        @for (s of statuses; track s) {
          <li class="flex items-center gap-1.5">
            <span
              class="size-2.5 rounded-full ring-1 ring-black/40"
              [style.background]="color[s]"
            ></span
            >{{ statusLabel[s] }}
          </li>
        }
      </ul>
      <h3 class="mt-3 mb-1 font-medium text-slate-300">Type (zoom in)</h3>
      <ul class="grid grid-cols-2 gap-1">
        @for (t of types; track t) {
          <li class="flex items-center gap-1.5">
            <span
              class="grid size-4 place-items-center rounded-full bg-slate-200 text-[9px] font-bold text-ink-950"
              >{{ glyph[t] }}</span
            >
            {{ typeLabel[t] }}
          </li>
        }
      </ul>
      @if (mode() === 'heatmap') {
        <div class="mt-3">
          <div
            class="h-2 rounded bg-gradient-to-r from-indigo-500 via-green-500 via-60% to-red-500"
          ></div>
          <div class="flex justify-between text-slate-400">
            <span>low PM2.5</span><span>35 µg/m³+</span>
          </div>
        </div>
      }
      <button
        type="button"
        class="mt-3 flex w-full items-center justify-center gap-1.5 rounded-md bg-slate-800 py-1 text-slate-300 hover:bg-slate-700"
        (click)="darkChange.emit(!dark())"
        [attr.aria-pressed]="!dark()"
      >
        <app-icon [name]="dark() ? 'sun' : 'moon'" [size]="14" />
        {{ dark() ? 'Light' : 'Dark' }} basemap
      </button>
    </section>
  `,
})
export class MapLegend {
  readonly mode = input.required<LayerMode>();
  readonly dark = input.required<boolean>();
  readonly modeChange = output<LayerMode>();
  readonly darkChange = output<boolean>();

  protected readonly modes = LAYER_MODES;
  protected readonly modeLabel = MODE_LABELS;
  protected readonly statuses = SENSOR_STATUSES;
  protected readonly types = SENSOR_TYPES;
  protected readonly color = STATUS_COLORS;
  protected readonly statusLabel = STATUS_LABELS;
  protected readonly typeLabel = TYPE_LABELS;
  protected readonly glyph = TYPE_GLYPHS;
}

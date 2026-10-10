import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { HoverState } from '../map-controller';

/** Hover/keyboard-focus tooltip, positioned in map container pixels. */
@Component({
  selector: 'app-map-tooltip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'pointer-events-none absolute z-20',
    '[style.left.px]': 'left()',
    '[style.top.px]': 'top()',
  },
  template: `
    @let t = state().tooltip;
    <div
      role="tooltip"
      id="map-tooltip"
      data-testid="map-tooltip"
      class="w-64 rounded-lg border border-slate-700 bg-ink-900/95 p-3 text-xs text-slate-200 shadow-xl backdrop-blur"
    >
      @if (t.kind === 'sensor') {
        <div class="flex items-start justify-between gap-2">
          <div>
            <p class="text-sm font-semibold text-white">{{ t.name }}</p>
            <p class="font-mono text-slate-400" data-testid="tooltip-id">
              {{ t.id }} · {{ t.typeLabel }}
            </p>
          </div>
          <span
            class="rounded-full px-2 py-0.5 font-medium"
            data-testid="tooltip-status"
            [style.background]="t.statusColor + '26'"
            [style.color]="t.statusColor"
            >{{ t.statusLabel }}</span
          >
        </div>
        <p class="mt-1 text-slate-400">{{ t.place }}</p>
        <dl class="mt-2 grid grid-cols-3 gap-2">
          <div>
            <dt class="text-slate-500">Latest</dt>
            <dd class="font-semibold text-white" data-testid="tooltip-value">{{ t.value }}</dd>
          </div>
          <div>
            <dt class="text-slate-500">Battery</dt>
            <dd class="font-semibold text-white">{{ t.battery }}</dd>
          </div>
          <div>
            <dt class="text-slate-500">Last seen</dt>
            <dd class="font-semibold text-white">{{ t.lastSeen }}</dd>
          </div>
        </dl>
        @if (state().keyboard) {
          <p class="mt-2 text-slate-500">Enter: open details · N/P: next/previous</p>
        }
      } @else {
        <p class="text-sm font-semibold text-white" data-testid="tooltip-cluster-count">
          {{ t.count }} sensors
        </p>
        <ul class="mt-2 space-y-1">
          @for (b of t.breakdown; track b.status) {
            <li class="flex items-center gap-2">
              <span class="size-2 rounded-full" [style.background]="b.color"></span>
              <span class="flex-1">{{ b.label }}</span>
              <span class="tabular-nums">{{ b.count }}</span>
            </li>
          }
        </ul>
        <p class="mt-2 text-slate-500">Click to zoom in</p>
      }
    </div>
  `,
})
export class MapTooltip {
  readonly state = input.required<HoverState>();
  readonly containerWidth = input(1024);
  // Flip to the left near the right edge so the tooltip stays on screen.
  protected readonly left = computed(() => {
    const x = this.state().point.x;
    return x + 280 > this.containerWidth() ? x - 272 : x + 16;
  });
  protected readonly top = computed(() => Math.max(8, this.state().point.y - 16));
}

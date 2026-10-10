import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { SensorStatus } from '../api/generated/graphql';
import { STATUS_COLORS, STATUS_LABELS } from '../core/sensor-meta';

@Component({
  selector: 'app-status-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span
    class="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium"
    [style.background]="color() + '26'"
    [style.color]="color()"
    ><span class="size-1.5 rounded-full" [style.background]="color()"></span>{{ label() }}</span
  >`,
})
export class StatusBadge {
  readonly status = input.required<SensorStatus>();
  protected readonly color = computed(() => STATUS_COLORS[this.status()]);
  protected readonly label = computed(() => STATUS_LABELS[this.status()]);
}

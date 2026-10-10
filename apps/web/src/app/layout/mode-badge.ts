import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ApiModeService } from '../core/api-mode.service';
import { ENGINE_LABELS, selectMapEngine } from '../core/map-engine-choice';
import { RUNTIME_CONFIG } from '../core/runtime-config';

/** "MOCK API" / "LIVE API" plus the active map engine. */
@Component({
  selector: 'app-mode-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex items-center gap-2 text-xs font-semibold">
      <span
        data-testid="mode-badge"
        class="rounded-md px-2 py-1 ring-1"
        [class]="
          mode.mode() === 'live'
            ? 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/40'
            : 'bg-amber-500/15 text-amber-300 ring-amber-500/40'
        "
        [attr.title]="mode.reachable() === false ? 'API unreachable' : null"
        >{{ mode.label() }}
        @if (mode.reachable() === false) {
          <span class="text-red-300"> · offline</span>
        }
      </span>
      <span
        data-testid="engine-badge"
        class="rounded-md bg-slate-800 px-2 py-1 text-slate-300 ring-1 ring-slate-700"
        >{{ engine() }}</span
      >
    </div>
  `,
})
export class ModeBadge {
  protected readonly mode = inject(ApiModeService);
  private readonly config = inject(RUNTIME_CONFIG);
  protected readonly engine = computed(
    () => ENGINE_LABELS[selectMapEngine(this.config.mapboxToken)],
  );
}

import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { KpisGQL, type KpisQuery } from '../api/generated/graphql';
import { formatCount, formatPercent } from '../core/format';
import { completeData } from '../shared/complete';

export interface Kpi {
  id: string;
  label: string;
  value: string;
  tone?: 'ok' | 'bad';
}

/** Header KPIs from GraphQL sensorStats, refreshed every 30 s. */
@Component({
  selector: 'app-kpi-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dl class="flex flex-wrap items-center gap-x-6 gap-y-1" aria-label="Network KPIs">
      @for (kpi of kpis(); track kpi.id) {
        <div class="flex items-baseline gap-2" [attr.data-testid]="'kpi-' + kpi.id">
          <dt class="text-xs uppercase tracking-wide text-slate-400">{{ kpi.label }}</dt>
          <dd
            class="text-sm font-semibold tabular-nums"
            [class.text-emerald-400]="kpi.tone === 'ok'"
            [class.text-red-400]="kpi.tone === 'bad'"
            [class.text-slate-100]="!kpi.tone"
          >
            {{ kpi.value }}
          </dd>
        </div>
      }
    </dl>
  `,
})
export class KpiBar {
  private readonly stats = toSignal(
    inject(KpisGQL)
      .watch({ pollInterval: 30_000 })
      .valueChanges.pipe(
        completeData<KpisQuery>(),
        map((d) => d.sensorStats),
      ),
    { initialValue: null },
  );

  protected readonly kpis = computed<Kpi[]>(() => {
    const s = this.stats();
    if (!s) return [{ id: 'loading', label: 'Loading', value: '…' }];
    const online = s.byStatus.find((b) => b.status === 'ONLINE')?.count ?? 0;
    return [
      { id: 'total', label: 'Sensors', value: formatCount(s.total) },
      { id: 'online', label: 'Online', value: formatPercent(online, s.total), tone: 'ok' },
      { id: 'alerts', label: 'Active alerts', value: formatCount(s.activeAlerts), tone: 'bad' },
      { id: 'regions', label: 'Regions', value: formatCount(s.regionsCovered) },
    ];
  });
}

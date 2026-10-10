import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DashboardGQL, type DashboardQuery } from '../../api/generated/graphql';
import { formatCount, formatPercent, formatValue } from '../../core/format';
import { METRIC_LABELS, STATUS_COLORS, STATUS_LABELS, TYPE_LABELS } from '../../core/sensor-meta';
import { completeData } from '../../shared/complete';

@Component({
  selector: 'app-dashboard-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-6xl space-y-6 p-6">
      <h1 class="text-2xl font-semibold">Dashboard</h1>
      @if (data(); as d) {
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          @for (m of d.sensorStats.averages; track m.metric) {
            <article class="rounded-xl border border-slate-800 bg-ink-900 p-4">
              <h2 class="text-xs uppercase tracking-wide text-slate-400">
                Avg {{ metricLabel[m.metric] }}
              </h2>
              <p class="mt-1 text-2xl font-semibold tabular-nums">
                {{ value(m.average, m.unit, m.metric) }}
              </p>
              <p class="text-xs text-slate-500">{{ m.sampleSize }} sensors reporting</p>
            </article>
          }
        </div>

        <div class="grid gap-4 lg:grid-cols-2">
          <article class="rounded-xl border border-slate-800 bg-ink-900 p-4">
            <h2 class="mb-3 font-medium">Status</h2>
            <ul class="space-y-2">
              @for (s of d.sensorStats.byStatus; track s.status) {
                <li class="flex items-center gap-3 text-sm">
                  <span class="w-24 text-slate-300">{{ statusLabel[s.status] }}</span>
                  <span class="h-2 flex-1 overflow-hidden rounded bg-slate-800">
                    <span
                      class="block h-full"
                      [style.width.%]="(s.count / d.sensorStats.total) * 100"
                      [style.background]="statusColor[s.status]"
                    ></span>
                  </span>
                  <span class="w-24 text-right tabular-nums"
                    >{{ count(s.count) }} · {{ pct(s.count, d.sensorStats.total) }}</span
                  >
                </li>
              }
            </ul>
          </article>
          <article class="rounded-xl border border-slate-800 bg-ink-900 p-4">
            <h2 class="mb-3 font-medium">Sensor types</h2>
            <ul class="space-y-2 text-sm">
              @for (t of d.sensorStats.byType; track t.type) {
                <li class="flex justify-between">
                  <span class="text-slate-300">{{ typeLabel[t.type] }}</span
                  ><span class="tabular-nums">{{ count(t.count) }}</span>
                </li>
              }
            </ul>
          </article>
        </div>

        <article class="rounded-xl border border-slate-800 bg-ink-900 p-4">
          <h2 class="mb-3 font-medium">Regions (maakunnat)</h2>
          <div class="overflow-x-auto">
            <table class="w-full text-left text-sm">
              <thead class="text-xs uppercase text-slate-400">
                <tr>
                  <th scope="col" class="py-2">Region</th>
                  <th scope="col" class="text-right">Sensors</th>
                  <th scope="col" class="text-right">Online</th>
                  <th scope="col" class="text-right">Alert</th>
                </tr>
              </thead>
              <tbody>
                @for (r of regionsBySize(); track r.region) {
                  <tr class="border-t border-slate-800">
                    <th scope="row" class="py-2 font-normal">{{ r.region }}</th>
                    <td class="text-right tabular-nums">{{ count(r.sensorCount) }}</td>
                    <td class="text-right tabular-nums text-emerald-400">
                      {{ count(r.onlineCount) }}
                    </td>
                    <td class="text-right tabular-nums text-red-400">{{ count(r.alertCount) }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </article>
      } @else {
        <p class="text-slate-400" role="status">Loading…</p>
      }
    </section>
  `,
})
export class DashboardPage {
  protected readonly data = toSignal(
    inject(DashboardGQL)
      .watch({ pollInterval: 30_000 })
      .valueChanges.pipe(completeData<DashboardQuery>()),
  );
  protected readonly regionsBySize = computed(() =>
    [...(this.data()?.regions ?? [])].sort((a, b) => b.sensorCount - a.sensorCount),
  );
  protected readonly metricLabel = METRIC_LABELS;
  protected readonly statusLabel = STATUS_LABELS;
  protected readonly statusColor = STATUS_COLORS;
  protected readonly typeLabel = TYPE_LABELS;
  protected readonly value = formatValue;
  protected readonly count = formatCount;
  protected readonly pct = formatPercent;
}

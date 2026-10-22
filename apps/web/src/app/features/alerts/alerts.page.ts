import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { switchMap } from 'rxjs';
import { AlertsGQL, type AlertsQuery } from '../../api/generated/graphql';
import { formatCount, relativeTime } from '../../core/format';
import { SEVERITY_LABELS } from '../../core/sensor-meta';
import { completeData } from '../../shared/complete';

/** Most recent alerts fetched; the list says so when it is truncated. */
const LIMIT = 300;

@Component({
  selector: 'app-alerts-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <section class="page">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <h1 class="page-title">Alerts</h1>
        <label class="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
          <input
            #active
            type="checkbox"
            class="size-4 accent-indigo-500"
            [checked]="activeOnly()"
            (change)="activeOnly.set(active.checked)"
          />
          Active only
        </label>
      </div>
      @if (alerts(); as a) {
        <p class="text-sm text-slate-400" aria-live="polite">
          {{ summary(a.alerts.length) }}
        </p>
        <ul class="card divide-y divide-slate-800">
          @for (alert of a.alerts; track alert.id) {
            <li class="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm">
              <span
                class="w-20 rounded px-2 py-0.5 text-center text-xs font-semibold"
                [class]="
                  alert.severity === 'CRITICAL'
                    ? 'bg-red-500/20 text-red-300'
                    : 'bg-amber-500/20 text-amber-300'
                "
                >{{ severityLabel[alert.severity] }}</span
              >
              <span class="min-w-48 flex-1">{{ alert.message }}</span>
              <a
                class="text-indigo-300 hover:underline"
                routerLink="/map"
                [queryParams]="{ sensor: alert.sensorId }"
                >{{ alert.sensorName }}
                <span class="font-mono text-xs text-slate-400">{{ alert.sensorId }}</span></a
              >
              <time
                class="w-24 text-right text-xs whitespace-nowrap text-slate-400"
                [attr.datetime]="alert.createdAt"
                [attr.title]="alert.createdAt"
                >{{ ago(alert.createdAt) }}</time
              >
              @if (alert.resolvedAt) {
                <span
                  class="rounded bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-300"
                  >Resolved</span
                >
              }
            </li>
          } @empty {
            <li class="px-4 py-8 text-center text-sm text-slate-400">
              {{ activeOnly() ? 'No active alerts. All clear.' : 'No alerts recorded.' }}
            </li>
          }
        </ul>
      } @else {
        <p class="text-slate-400" role="status">Loading alerts…</p>
      }
    </section>
  `,
})
export class AlertsPage {
  private readonly gql = inject(AlertsGQL);
  protected readonly activeOnly = signal(true);
  protected readonly alerts = toSignal(
    toObservable(this.activeOnly).pipe(
      switchMap((activeOnly) =>
        this.gql
          .watch({ variables: { activeOnly, first: LIMIT } })
          .valueChanges.pipe(completeData<AlertsQuery>()),
      ),
    ),
  );
  protected readonly severityLabel = SEVERITY_LABELS;
  protected readonly ago = relativeTime;

  protected summary(n: number): string {
    const kind = this.activeOnly() ? 'active alert' : 'alert';
    if (n >= LIMIT) return `Showing the ${formatCount(LIMIT)} most recent ${kind}s`;
    return `${formatCount(n)} ${kind}${n === 1 ? '' : 's'}`;
  }
}

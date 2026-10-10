import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { switchMap } from 'rxjs';
import { AlertsGQL, type AlertsQuery } from '../../api/generated/graphql';
import { relativeTime } from '../../core/format';
import { completeData } from '../../shared/complete';

@Component({
  selector: 'app-alerts-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <section class="mx-auto max-w-6xl space-y-4 p-6">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <h1 class="text-2xl font-semibold">Alerts</h1>
        <label class="flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            [checked]="activeOnly()"
            (change)="activeOnly.set(!activeOnly())"
          />
          Active only
        </label>
      </div>
      @if (alerts(); as a) {
        <p class="text-sm text-slate-400">{{ a.alerts.length }} alerts</p>
        <ul class="divide-y divide-slate-800 rounded-xl border border-slate-800 bg-ink-900">
          @for (alert of a.alerts; track alert.id) {
            <li class="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
              <span
                class="rounded px-2 py-0.5 text-xs font-semibold"
                [class]="
                  alert.severity === 'CRITICAL'
                    ? 'bg-red-500/20 text-red-300'
                    : 'bg-amber-500/20 text-amber-300'
                "
                >{{ alert.severity }}</span
              >
              <span class="flex-1">{{ alert.message }}</span>
              <a
                class="text-indigo-300 hover:underline"
                routerLink="/map"
                [queryParams]="{ sensor: alert.sensorId }"
                >{{ alert.sensorName }} ({{ alert.sensorId }})</a
              >
              <span class="w-28 text-right text-xs text-slate-400">{{ ago(alert.createdAt) }}</span>
              @if (alert.resolvedAt) {
                <span class="text-xs text-emerald-400">resolved</span>
              }
            </li>
          }
        </ul>
      } @else {
        <p class="text-slate-400" role="status">Loading…</p>
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
          .watch({ variables: { activeOnly, first: 300 } })
          .valueChanges.pipe(completeData<AlertsQuery>()),
      ),
    ),
  );
  protected readonly ago = relativeTime;
}

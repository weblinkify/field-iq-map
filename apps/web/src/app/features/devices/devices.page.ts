import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { debounceTime, switchMap } from 'rxjs';
import { DevicesGQL, type DevicesQuery } from '../../api/generated/graphql';
import { relativeTime } from '../../core/format';
import { TYPE_LABELS } from '../../core/sensor-meta';
import { completeData } from '../../shared/complete';
import { StatusBadge } from '../../shared/status-badge';

@Component({
  selector: 'app-devices-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, StatusBadge],
  template: `
    <section class="mx-auto max-w-6xl space-y-4 p-6">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <h1 class="text-2xl font-semibold">Devices</h1>
        <label class="text-sm text-slate-300"
          >Search id, name, municipality
          <input
            type="search"
            class="ml-2 rounded-md border border-slate-700 bg-ink-900 px-3 py-1.5 text-slate-100"
            (input)="search.set($any($event.target).value)"
        /></label>
      </div>
      @if (page(); as p) {
        <p class="text-sm text-slate-400">
          {{ p.sensors.totalCount }} devices · showing {{ p.sensors.edges.length }}
        </p>
        <div class="overflow-x-auto rounded-xl border border-slate-800 bg-ink-900">
          <table class="w-full text-left text-sm">
            <thead class="text-xs uppercase text-slate-400">
              <tr>
                <th scope="col" class="px-4 py-2">Device</th>
                <th scope="col">Type</th>
                <th scope="col">Status</th>
                <th scope="col">Site</th>
                <th scope="col" class="text-right">Battery</th>
                <th scope="col">Firmware</th>
                <th scope="col" class="px-4">Last seen</th>
              </tr>
            </thead>
            <tbody>
              @for (e of p.sensors.edges; track e.node.id) {
                <tr class="border-t border-slate-800">
                  <th scope="row" class="px-4 py-2 font-normal">
                    <a
                      class="text-indigo-300 hover:underline"
                      routerLink="/map"
                      [queryParams]="{ sensor: e.node.id }"
                      >{{ e.node.id }}</a
                    >
                    <span class="block text-xs text-slate-400">{{ e.node.name }}</span>
                  </th>
                  <td>{{ typeLabel[e.node.type] }}</td>
                  <td><app-status-badge [status]="e.node.status" /></td>
                  <td>{{ e.node.siteName }}</td>
                  <td class="text-right tabular-nums">{{ e.node.batteryPct }} %</td>
                  <td>{{ e.node.firmware }}</td>
                  <td class="px-4">{{ ago(e.node.lastSeenAt) }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <div class="flex gap-2">
          <button
            type="button"
            class="rounded-md border border-slate-700 px-3 py-1.5 text-sm disabled:opacity-40"
            [disabled]="cursors().length === 0"
            (click)="prev()"
          >
            Previous
          </button>
          <button
            type="button"
            class="rounded-md border border-slate-700 px-3 py-1.5 text-sm disabled:opacity-40"
            [disabled]="!p.sensors.pageInfo.hasNextPage"
            (click)="next(p.sensors.pageInfo.endCursor)"
          >
            Next
          </button>
        </div>
      } @else {
        <p class="text-slate-400" role="status">Loading…</p>
      }
    </section>
  `,
})
export class DevicesPage {
  private readonly gql = inject(DevicesGQL);
  protected readonly search = signal('');
  protected readonly cursors = signal<(string | null)[]>([]);
  private readonly after = computed(() => this.cursors().at(-1) ?? null);
  private readonly request = computed(() => ({ search: this.search(), after: this.after() }));

  protected readonly page = toSignal(
    toObservable(this.request).pipe(
      debounceTime(150),
      switchMap(({ search, after }) =>
        this.gql
          .watch({ variables: { filter: { search: search || null }, first: 50, after } })
          .valueChanges.pipe(completeData<DevicesQuery>()),
      ),
    ),
  );
  protected readonly typeLabel = TYPE_LABELS;
  protected readonly ago = relativeTime;

  constructor() {
    toObservable(this.search).subscribe(() => {
      if (this.cursors().length) this.cursors.set([]);
    });
  }

  protected next(cursor: string | null): void {
    if (cursor) this.cursors.update((c) => [...c, cursor]);
  }

  protected prev(): void {
    this.cursors.update((c) => c.slice(0, -1));
  }
}

import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { debounceTime, switchMap } from 'rxjs';
import { DevicesGQL, type DevicesQuery } from '../../api/generated/graphql';
import { relativeTime } from '../../core/format';
import { TYPE_LABELS } from '../../core/sensor-meta';
import { completeData } from '../../shared/complete';
import { Pager } from '../../shared/pager';
import { StatusBadge } from '../../shared/status-badge';

const PAGE_SIZE = 50;

@Component({
  selector: 'app-devices-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Pager, StatusBadge],
  template: `
    <section class="page">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <h1 class="page-title">Devices</h1>
        <label class="flex items-center gap-2 text-sm text-slate-300">
          <span class="sr-only">Search devices</span>
          <input
            #q
            type="search"
            class="input w-72"
            placeholder="Search id, name or municipality"
            [value]="search()"
            (input)="setSearch(q.value)"
          />
        </label>
      </div>
      @if (page(); as p) {
        <div class="card overflow-x-auto">
          <table class="data-table">
            <thead>
              <tr>
                <th scope="col">Device</th>
                <th scope="col">Type</th>
                <th scope="col">Status</th>
                <th scope="col">Site</th>
                <th scope="col" class="text-right">Battery</th>
                <th scope="col">Firmware</th>
                <th scope="col">Last seen</th>
              </tr>
            </thead>
            <tbody>
              @for (e of p.sensors.edges; track e.node.id) {
                <tr>
                  <th scope="row">
                    <a
                      class="font-mono text-indigo-300 hover:underline"
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
                  <td class="font-mono text-xs text-slate-300">{{ e.node.firmware }}</td>
                  <td class="whitespace-nowrap text-slate-300">{{ ago(e.node.lastSeenAt) }}</td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="7" class="py-8 text-center text-slate-400">
                    No devices match “{{ search() }}”.
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <app-pager
          class="text-sm"
          [pageIndex]="cursors().length"
          [pageSize]="pageSize"
          [shown]="p.sensors.edges.length"
          [total]="p.sensors.totalCount"
          [hasNext]="p.sensors.pageInfo.hasNextPage"
          (previous)="prev()"
          (next)="next(p.sensors.pageInfo.endCursor)"
        />
      } @else {
        <p class="text-slate-400" role="status">Loading devices…</p>
      }
    </section>
  `,
})
export class DevicesPage {
  private readonly gql = inject(DevicesGQL);
  protected readonly search = signal('');
  protected readonly cursors = signal<string[]>([]);
  protected readonly pageSize = PAGE_SIZE;
  private readonly request = computed(() => ({
    search: this.search().trim(),
    after: this.cursors().at(-1) ?? null,
  }));

  protected readonly page = toSignal(
    toObservable(this.request).pipe(
      debounceTime(150),
      switchMap(({ search, after }) =>
        this.gql
          .watch({ variables: { filter: { search: search || null }, first: PAGE_SIZE, after } })
          .valueChanges.pipe(completeData<DevicesQuery>()),
      ),
    ),
  );
  protected readonly typeLabel = TYPE_LABELS;
  protected readonly ago = relativeTime;

  /** A new search starts again at page 1. */
  protected setSearch(value: string): void {
    this.search.set(value);
    this.cursors.set([]);
  }

  protected next(cursor: string | null): void {
    if (cursor) this.cursors.update((c) => [...c, cursor]);
  }

  protected prev(): void {
    this.cursors.update((c) => c.slice(0, -1));
  }
}

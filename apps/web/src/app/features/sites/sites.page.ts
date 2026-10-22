import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { SitesGQL, type SitesQuery } from '../../api/generated/graphql';
import { formatCount } from '../../core/format';
import { completeData } from '../../shared/complete';

@Component({
  selector: 'app-sites-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <section class="page">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <h1 class="page-title">Sites</h1>
        <label class="flex items-center gap-2 text-sm text-slate-300">
          <span class="sr-only">Search sites</span>
          <input
            #q
            type="search"
            class="input w-72"
            placeholder="Search site, municipality or region"
            [value]="query()"
            (input)="query.set(q.value)"
          />
        </label>
      </div>
      @if (sites(); as all) {
        <p class="text-sm text-slate-400">
          {{ count(filtered().length) }}
          @if (filtered().length !== all.length) {
            of {{ count(all.length) }}
          }
          monitoring sites
        </p>
        <div class="card overflow-x-auto">
          <table class="data-table">
            <thead>
              <tr>
                <th scope="col">Site</th>
                <th scope="col">Municipality</th>
                <th scope="col">Region</th>
                <th scope="col" class="text-right">Sensors</th>
                <th scope="col" class="text-right"><span class="sr-only">Map</span></th>
              </tr>
            </thead>
            <tbody>
              @for (s of filtered(); track s.id) {
                <tr>
                  <th scope="row">{{ s.name }}</th>
                  <td>{{ s.municipality }}</td>
                  <td>{{ s.region }}</td>
                  <td class="text-right tabular-nums">{{ count(s.sensorCount) }}</td>
                  <td class="text-right">
                    <a
                      class="text-indigo-300 hover:underline"
                      routerLink="/map"
                      [queryParams]="{ bbox: around(s.location.lat, s.location.lon) }"
                      [attr.aria-label]="'Show ' + s.name + ' on the map'"
                      >Show on map</a
                    >
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="5" class="py-8 text-center text-slate-400">
                    No sites match “{{ query() }}”.
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      } @else {
        <p class="text-slate-400" role="status">Loading sites…</p>
      }
    </section>
  `,
})
export class SitesPage {
  protected readonly query = signal('');
  protected readonly sites = toSignal(
    inject(SitesGQL)
      .watch()
      .valueChanges.pipe(
        completeData<SitesQuery>(),
        map((d) => d.sites),
      ),
  );
  protected readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    const all = this.sites() ?? [];
    return q
      ? all.filter((s) => `${s.name} ${s.municipality} ${s.region}`.toLowerCase().includes(q))
      : all;
  });
  protected readonly count = formatCount;

  /** ~5 km box around a site, as a shareable map bbox. */
  protected around(lat: number, lon: number): string {
    const dLat = 0.045;
    const dLon = 0.045 / Math.cos((lat * Math.PI) / 180);
    return [lon - dLon, lat - dLat, lon + dLon, lat + dLat].map((n) => n.toFixed(4)).join(',');
  }
}

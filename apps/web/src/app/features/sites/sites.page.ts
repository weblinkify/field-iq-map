import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { SitesGQL, type SitesQuery } from '../../api/generated/graphql';
import { completeData } from '../../shared/complete';

@Component({
  selector: 'app-sites-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <section class="mx-auto max-w-6xl space-y-4 p-6">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <h1 class="text-2xl font-semibold">Sites</h1>
        <label class="text-sm text-slate-300"
          >Search
          <input
            type="search"
            class="ml-2 rounded-md border border-slate-700 bg-ink-900 px-3 py-1.5 text-slate-100"
            [value]="query()"
            (input)="query.set($any($event.target).value)"
        /></label>
      </div>
      <p class="text-sm text-slate-400">{{ filtered().length }} monitoring sites</p>
      <div class="overflow-x-auto rounded-xl border border-slate-800 bg-ink-900">
        <table class="w-full text-left text-sm">
          <thead class="text-xs uppercase text-slate-400">
            <tr>
              <th scope="col" class="px-4 py-2">Site</th>
              <th scope="col">Municipality</th>
              <th scope="col">Region</th>
              <th scope="col" class="text-right">Sensors</th>
              <th scope="col" class="px-4 text-right">Map</th>
            </tr>
          </thead>
          <tbody>
            @for (s of filtered(); track s.id) {
              <tr class="border-t border-slate-800">
                <th scope="row" class="px-4 py-2 font-normal">{{ s.name }}</th>
                <td>{{ s.municipality }}</td>
                <td>{{ s.region }}</td>
                <td class="text-right tabular-nums">{{ s.sensorCount }}</td>
                <td class="px-4 text-right">
                  <a
                    class="text-indigo-300 hover:underline"
                    routerLink="/map"
                    [queryParams]="{ bbox: around(s.location.lat, s.location.lon) }"
                    >Show</a
                  >
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </section>
  `,
})
export class SitesPage {
  protected readonly query = signal('');
  private readonly sites = toSignal(
    inject(SitesGQL).watch().valueChanges.pipe(completeData<SitesQuery>()),
  );
  protected readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    const all = this.sites()?.sites ?? [];
    return q
      ? all.filter((s) => `${s.name} ${s.municipality} ${s.region}`.toLowerCase().includes(q))
      : all;
  });

  /** ~5 km box around a site, as a shareable map bbox. */
  protected around(lat: number, lon: number): string {
    const dLat = 0.045;
    const dLon = 0.045 / Math.cos((lat * Math.PI) / 180);
    return [lon - dLon, lat - dLat, lon + dLon, lat + dLat].map((n) => n.toFixed(4)).join(',');
  }
}

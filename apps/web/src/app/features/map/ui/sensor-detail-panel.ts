import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  DestroyRef,
  input,
  output,
  signal,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { switchMap } from 'rxjs';
import {
  SensorDetailGQL,
  type Metric,
  type SensorDetailQuery,
} from '../../../api/generated/graphql';
import { formatCoordinates, formatValue, relativeTime } from '../../../core/format';
import { METRIC_LABELS, SEVERITY_LABELS, TYPE_LABELS } from '../../../core/sensor-meta';
import { completeData } from '../../../shared/complete';
import { Icon } from '../../../shared/icon';
import { Sparkline, type SparkPoint } from '../../../shared/sparkline';
import { StatusBadge } from '../../../shared/status-badge';

interface MetricSeries {
  metric: Metric;
  label: string;
  latest: string;
  points: SparkPoint[];
}

const METRIC_COLORS: Record<Metric, string> = {
  TEMPERATURE: '#f97316',
  HUMIDITY: '#38bdf8',
  NOISE: '#a78bfa',
  PM25: '#facc15',
};

/** Sensor details from GraphQL: metadata, 24 h chart per metric, active alerts. */
@Component({
  selector: 'app-sensor-detail-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, Sparkline, StatusBadge],
  host: { '(keydown.escape)': 'closed.emit()' },
  template: `
    <aside
      class="flex h-full w-full flex-col overflow-y-auto border-l border-slate-800 bg-ink-900/95 backdrop-blur sm:w-96"
      aria-labelledby="sensor-detail-title"
      data-testid="sensor-detail"
    >
      @if (sensor(); as s) {
        <header class="flex items-start justify-between gap-3 border-b border-slate-800 p-4">
          <div>
            <p class="font-mono text-xs text-slate-400" data-testid="detail-id">{{ s.id }}</p>
            <h2 id="sensor-detail-title" class="text-lg font-semibold">{{ s.name }}</h2>
            <div class="mt-1 flex items-center gap-2 text-xs text-slate-400">
              <app-status-badge [status]="s.status" /> {{ typeLabel[s.type] }}
            </div>
          </div>
          <button
            type="button"
            class="rounded-md p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
            aria-label="Close sensor details"
            (click)="closed.emit()"
          >
            <app-icon name="x" />
          </button>
        </header>

        <dl class="grid grid-cols-2 gap-3 p-4 text-sm">
          <div>
            <dt class="text-xs text-slate-500">Site</dt>
            <dd>{{ s.site.name }}</dd>
          </div>
          <div>
            <dt class="text-xs text-slate-500">Region</dt>
            <dd>{{ s.region }}</dd>
          </div>
          <div>
            <dt class="text-xs text-slate-500">Battery</dt>
            <dd>{{ s.batteryPct }} %</dd>
          </div>
          <div>
            <dt class="text-xs text-slate-500">Firmware</dt>
            <dd>{{ s.firmware }}</dd>
          </div>
          <div>
            <dt class="text-xs text-slate-500">Last seen</dt>
            <dd>{{ ago(s.lastSeenAt) }}</dd>
          </div>
          <div>
            <dt class="text-xs text-slate-500">Installed</dt>
            <dd>
              <time [attr.datetime]="s.installedAt">{{ s.installedAt.slice(0, 10) }}</time>
            </dd>
          </div>
          <div class="col-span-2">
            <dt class="text-xs text-slate-500">Coordinates</dt>
            <dd class="flex items-center gap-2 font-mono text-xs">
              {{ coords(s.location.lat, s.location.lon) }}
              <button
                type="button"
                class="inline-flex items-center gap-1 rounded border border-slate-700 px-2 py-0.5 font-sans text-slate-300 hover:bg-slate-800"
                (click)="copy(s.location.lat, s.location.lon)"
              >
                <app-icon name="copy" [size]="12" /> {{ copied() ? 'Copied' : 'Copy coordinates' }}
              </button>
            </dd>
          </div>
        </dl>

        <section class="space-y-3 border-t border-slate-800 p-4" aria-label="Last 24 hours">
          <h3 class="text-sm font-medium">Last 24 hours</h3>
          @for (m of series(); track m.metric) {
            <div>
              <div class="flex justify-between text-xs">
                <span class="text-slate-400">{{ m.label }}</span
                ><span class="font-semibold">{{ m.latest }}</span>
              </div>
              <app-sparkline
                [points]="m.points"
                [color]="color[m.metric]"
                [label]="m.label + ' over the last 24 hours'"
              />
            </div>
          }
        </section>

        <section class="border-t border-slate-800 p-4" aria-label="Active alerts">
          <h3 class="mb-2 text-sm font-medium">Active alerts</h3>
          @for (a of s.alerts; track a.id) {
            <p
              class="mb-2 rounded-md p-2 text-xs"
              [class]="
                a.severity === 'CRITICAL'
                  ? 'bg-red-500/15 text-red-200'
                  : 'bg-amber-500/15 text-amber-200'
              "
            >
              <strong>{{ severityLabel[a.severity] }}</strong> · {{ a.message }}
              <span class="block text-slate-400">{{ ago(a.createdAt) }}</span>
            </p>
          } @empty {
            <p class="text-xs text-slate-500">No active alerts</p>
          }
        </section>
      } @else if (missing()) {
        <p class="p-4 text-sm text-slate-400">Sensor {{ sensorId() }} was not found.</p>
      } @else {
        <p class="p-4 text-sm text-slate-400" role="status">Loading {{ sensorId() }}…</p>
      }
    </aside>
  `,
})
export class SensorDetailPanel {
  readonly sensorId = input.required<string>();
  readonly closed = output<void>();
  private readonly gql = inject(SensorDetailGQL);
  protected readonly copied = signal(false);
  private copiedTimer: ReturnType<typeof setTimeout> | undefined;

  private readonly data = toSignal(
    toObservable(this.sensorId).pipe(
      switchMap((id) => this.gql.watch({ variables: { id }, pollInterval: 30_000 }).valueChanges),
      completeData<SensorDetailQuery>(),
    ),
  );
  protected readonly sensor = computed(() => this.data()?.sensor ?? null);
  protected readonly missing = computed(
    () => this.data() !== undefined && this.data()?.sensor === null,
  );

  protected readonly series = computed<MetricSeries[]>(() => {
    const s = this.sensor();
    if (!s) return [];
    return s.latestReadings.map((latest) => ({
      metric: latest.metric,
      label: METRIC_LABELS[latest.metric],
      latest: formatValue(latest.value, latest.unit, latest.metric),
      points: s.readings
        .filter((r) => r.metric === latest.metric)
        .map((r) => ({ ts: r.ts, value: r.value })),
    }));
  });

  protected readonly typeLabel = TYPE_LABELS;
  protected readonly severityLabel = SEVERITY_LABELS;
  protected readonly color = METRIC_COLORS;
  protected readonly ago = relativeTime;
  protected readonly coords = formatCoordinates;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.copiedTimer));
  }

  protected copy(lat: number, lon: number): void {
    void navigator.clipboard?.writeText(formatCoordinates(lat, lon)).then(() => {
      this.copied.set(true);
      clearTimeout(this.copiedTimer);
      this.copiedTimer = setTimeout(() => this.copied.set(false), 1500);
    });
  }
}

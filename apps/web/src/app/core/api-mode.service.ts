import { computed, inject, Injectable, signal } from '@angular/core';
import { SensorsRestService } from '../api/rest/sensors-rest.service';
import { RUNTIME_CONFIG, type ApiMode } from './runtime-config';

/**
 * Which backend is answering. Starts from the runtime config and is confirmed by /health, so
 * the badge reflects the server actually behind the proxy.
 */
@Injectable({ providedIn: 'root' })
export class ApiModeService {
  private readonly config = inject(RUNTIME_CONFIG);
  private readonly rest = inject(SensorsRestService);
  private readonly reported = signal<ApiMode | null>(null);
  readonly reachable = signal<boolean | null>(null);

  readonly mode = computed<ApiMode>(() => this.reported() ?? this.config.apiMode);
  readonly label = computed(() => (this.mode() === 'live' ? 'LIVE API' : 'MOCK API'));

  check(): void {
    this.rest.health().subscribe({
      next: (h) => {
        this.reported.set(h.mode === 'live' ? 'live' : 'mock');
        this.reachable.set(true);
      },
      error: () => this.reachable.set(false),
    });
  }
}

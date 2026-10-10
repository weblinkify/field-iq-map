import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ApiModeService } from '../core/api-mode.service';
import { Icon, type IconName } from '../shared/icon';
import { KpiBar } from './kpi-bar';
import { ModeBadge } from './mode-badge';

interface NavItem {
  label: string;
  path: string;
  icon: IconName;
}

@Component({
  selector: 'app-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icon, KpiBar, ModeBadge],
  template: `
    <a
      href="#main"
      class="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-indigo-600 focus:px-3 focus:py-2"
      >Skip to content</a
    >
    <div class="flex h-dvh bg-ink-950 text-slate-100">
      <nav
        aria-label="Main"
        class="flex w-16 shrink-0 flex-col border-r border-slate-800 bg-ink-950 lg:w-56"
      >
        <div class="flex h-14 items-center gap-2 px-4">
          <span class="grid size-8 place-items-center rounded-lg bg-indigo-500 text-white"
            ><app-icon name="zap" [size]="18"
          /></span>
          <span class="hidden text-lg font-bold tracking-tight lg:inline"
            >Field<span class="text-indigo-400">IQ</span></span
          >
        </div>
        <ul class="mt-2 flex flex-col gap-1 px-2">
          @for (item of nav; track item.path) {
            <li>
              <a
                [routerLink]="item.path"
                routerLinkActive="bg-indigo-500/15 text-indigo-200"
                ariaCurrentWhenActive="page"
                class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-white focus-visible:outline-2 focus-visible:outline-indigo-400"
                [attr.aria-label]="item.label"
              >
                <app-icon [name]="item.icon" />
                <span class="hidden lg:inline">{{ item.label }}</span>
              </a>
            </li>
          }
        </ul>
        <p class="mt-auto hidden px-4 pb-4 text-xs text-slate-500 lg:block">
          Sense the field. Understand the data.
        </p>
      </nav>

      <div class="flex min-w-0 flex-1 flex-col">
        <header
          class="flex min-h-14 flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-ink-900/80 px-4 py-2"
        >
          <app-kpi-bar />
          <app-mode-badge />
        </header>
        <main id="main" class="relative min-h-0 flex-1 overflow-auto" tabindex="-1">
          <router-outlet />
        </main>
      </div>
    </div>
  `,
})
export class Shell implements OnInit {
  private readonly apiMode = inject(ApiModeService);

  protected readonly nav: readonly NavItem[] = [
    { label: 'Map', path: '/map', icon: 'map' },
    { label: 'Dashboard', path: '/dashboard', icon: 'dashboard' },
    { label: 'Sites', path: '/sites', icon: 'pin' },
    { label: 'Devices', path: '/devices', icon: 'cpu' },
    { label: 'Alerts', path: '/alerts', icon: 'bell' },
  ];

  ngOnInit(): void {
    this.apiMode.check();
  }
}

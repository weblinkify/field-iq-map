import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-map-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<section class="p-6"><h1 class="text-2xl font-semibold">Map</h1></section>`,
})
export class MapPage {}

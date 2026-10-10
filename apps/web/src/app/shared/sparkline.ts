import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export interface SparkPoint {
  ts: string;
  value: number;
}

/** Tiny dependency-free SVG line chart for 24 h histories. */
@Component({
  selector: 'app-sparkline',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (geometry(); as g) {
      <svg
        [attr.viewBox]="'0 0 ' + width + ' ' + height"
        class="h-12 w-full"
        role="img"
        [attr.aria-label]="label()"
      >
        <path [attr.d]="g.area" [attr.fill]="color()" fill-opacity="0.15" />
        <path [attr.d]="g.line" fill="none" [attr.stroke]="color()" stroke-width="1.5" />
        <circle [attr.cx]="g.last[0]" [attr.cy]="g.last[1]" r="2.5" [attr.fill]="color()" />
      </svg>
    } @else {
      <p class="text-xs text-slate-400">No readings in the last 24 h</p>
    }
  `,
})
export class Sparkline {
  readonly points = input.required<readonly SparkPoint[]>();
  readonly color = input('#818cf8');
  readonly label = input('24 hour trend');
  protected readonly width = 240;
  protected readonly height = 48;

  protected readonly geometry = computed(() => {
    const pts = this.points();
    if (pts.length < 2) return null;
    const values = pts.map((p) => p.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;
    const xy = pts.map((p, i): [number, number] => [
      (i / (pts.length - 1)) * this.width,
      this.height - 4 - ((p.value - min) / span) * (this.height - 8),
    ]);
    const line = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
    return {
      line,
      area: `${line} L${this.width},${this.height} L0,${this.height} Z`,
      last: xy[xy.length - 1] as [number, number],
    };
  });
}

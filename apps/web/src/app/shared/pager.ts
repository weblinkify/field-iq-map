import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { formatCount } from '../core/format';

/** "1–50 of 4,000" plus Previous / Next for cursor-paginated lists. */
@Component({
  selector: 'app-pager',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex items-center justify-between gap-3 text-slate-400' },
  template: `
    <span class="tabular-nums" aria-live="polite">{{ range() }}</span>
    <span class="flex gap-1.5">
      <button
        type="button"
        class="btn"
        [class.btn-sm]="compact()"
        [disabled]="pageIndex() === 0"
        (click)="previous.emit()"
      >
        Previous
      </button>
      <button
        type="button"
        class="btn"
        [class.btn-sm]="compact()"
        [disabled]="!hasNext()"
        (click)="next.emit()"
      >
        Next
      </button>
    </span>
  `,
})
export class Pager {
  readonly pageIndex = input.required<number>();
  readonly pageSize = input.required<number>();
  readonly shown = input.required<number>();
  readonly total = input.required<number>();
  readonly hasNext = input.required<boolean>();
  readonly compact = input(false, { transform: booleanAttribute });
  readonly previous = output<void>();
  readonly next = output<void>();

  protected readonly range = computed(() => {
    if (this.shown() === 0) return `0 of ${formatCount(this.total())}`;
    const first = this.pageIndex() * this.pageSize() + 1;
    const last = first + this.shown() - 1;
    return `${formatCount(first)}–${formatCount(last)} of ${formatCount(this.total())}`;
  });
}

import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

@Component({
  selector: 'app-pagination',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (totalPages() > 1) {
      <nav role="navigation" aria-label="Paginación" class="flex items-center justify-center gap-1">
        <button
          type="button"
          class="btn-secondary !px-3"
          [disabled]="page() === 0"
          (click)="goTo(page() - 1)"
          aria-label="Página anterior"
        >
          ‹
        </button>
        @for (p of visiblePages(); track p) {
          @if (p === -1) {
            <span class="px-2 text-slate-400" aria-hidden="true">…</span>
          } @else {
            <button
              type="button"
              class="btn !px-3"
              [class.bg-primary-600]="p === page()"
              [class.text-white]="p === page()"
              [class.btn-secondary]="p !== page()"
              [attr.aria-current]="p === page() ? 'page' : null"
              [attr.aria-label]="'Ir a la página ' + (p + 1)"
              (click)="goTo(p)"
            >
              {{ p + 1 }}
            </button>
          }
        }
        <button
          type="button"
          class="btn-secondary !px-3"
          [disabled]="page() >= totalPages() - 1"
          (click)="goTo(page() + 1)"
          aria-label="Página siguiente"
        >
          ›
        </button>
      </nav>
    }
  `
})
export class PaginationComponent {
  readonly page = input.required<number>();
  readonly totalPages = input.required<number>();
  readonly pageChange = output<number>();

  protected readonly visiblePages = computed(() => {
    const total = this.totalPages();
    const current = this.page();
    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i);
    }
    const pages: number[] = [0];
    if (current > 2) pages.push(-1);
    for (let p = Math.max(1, current - 1); p <= Math.min(total - 2, current + 1); p++) {
      pages.push(p);
    }
    if (current < total - 3) pages.push(-1);
    pages.push(total - 1);
    return pages;
  });

  goTo(page: number): void {
    if (page >= 0 && page < this.totalPages() && page !== this.page()) {
      this.pageChange.emit(page);
    }
  }
}

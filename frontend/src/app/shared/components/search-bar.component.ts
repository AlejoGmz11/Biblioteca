import { ChangeDetectionStrategy, Component, DestroyRef, inject, input, output } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';

@Component({
  selector: 'app-search-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="relative">
      <svg
        class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
        fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"
      >
        <path stroke-linecap="round" stroke-linejoin="round" d="m21 21-4.34-4.34M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z" />
      </svg>
      <label class="sr-only" for="search-input">{{ placeholder() }}</label>
      <input
        id="search-input"
        type="search"
        class="input pl-9"
        [placeholder]="placeholder()"
        (input)="onInput($event)"
        (keydown.escape)="clear($event)"
      />
    </div>
  `
})
export class SearchBarComponent {
  readonly placeholder = input('Buscar por título, autor o ISBN…');
  readonly debounceMs = input(300);
  readonly search = output<string>();

  private readonly terms = new Subject<string>();

  constructor() {
    const destroyRef = inject(DestroyRef);
    this.terms
      .pipe(debounceTime(this.debounceMs()), distinctUntilChanged(), takeUntilDestroyed(destroyRef))
      .subscribe((term) => this.search.emit(term));
  }

  onInput(event: Event): void {
    this.terms.next((event.target as HTMLInputElement).value.trim());
  }

  clear(event: Event): void {
    const input = event.target as HTMLInputElement;
    input.value = '';
    this.terms.next('');
  }
}

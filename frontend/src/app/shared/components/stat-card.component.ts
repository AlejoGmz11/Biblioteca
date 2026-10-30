import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IconComponent } from './icon.component';

@Component({
  selector: 'app-stat-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <article class="card relative overflow-hidden p-5 transition-shadow hover:shadow-md">
      <div class="flex items-start justify-between gap-3">
        <div>
          <p class="text-sm font-medium text-slate-500 dark:text-slate-400">{{ label() }}</p>
          <p class="mt-1 text-3xl font-bold tracking-tight">{{ value() }}</p>
          @if (hint()) {
            <p class="mt-1 text-xs text-slate-400 dark:text-slate-500">{{ hint() }}</p>
          }
        </div>
        @if (icon()) {
          <span
            class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-700 dark:bg-primary-900/50 dark:text-primary-300"
            aria-hidden="true"
          >
            <app-icon [name]="icon()" [size]="22" />
          </span>
        }
      </div>
    </article>
  `
})
export class StatCardComponent {
  readonly label = input.required<string>();
  readonly value = input.required<string | number>();
  readonly hint = input<string>('');
  /** Nombre de icono de IconComponent (p. ej. 'books', 'book-open'). */
  readonly icon = input<string>('');
}

import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Book } from '../../core/models';
import { BookService } from '../../core/services/book.service';
import { BookTypeLabelPipe } from '../pipes/book-type-label.pipe';
import { ReadingStatusLabelPipe } from '../pipes/reading-status-label.pipe';
import { StarRatingComponent } from './star-rating.component';
import { IconComponent } from './icon.component';

@Component({
  selector: 'app-book-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, BookTypeLabelPipe, ReadingStatusLabelPipe, StarRatingComponent, IconComponent],
  template: `
    <article class="card group flex h-full flex-col overflow-hidden transition-shadow hover:shadow-md">
      <a
        [routerLink]="['/books', book().id]"
        class="flex h-full flex-col"
        [attr.aria-label]="'Ver detalle de ' + book().title"
      >
        <div class="relative aspect-[2/3] w-full overflow-hidden bg-slate-100 dark:bg-slate-800">
          @if (cover()) {
            <img
              [src]="cover()"
              [alt]="'Portada de ' + book().title + ' de ' + book().author"
              loading="lazy"
              class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          } @else {
            <div class="flex h-full items-center justify-center p-4 text-slate-300 dark:text-slate-600" aria-hidden="true">
              <app-icon name="book-open" [size]="48" [strokeWidth]="1.2" />
            </div>
          }
          <span
            class="absolute left-2 top-2 rounded-full px-2 py-0.5 text-xs font-medium text-white"
            [class.bg-khaki-beige]="status() === 'PENDING'"
            [class.text-charcoal-brown]="status() === 'PENDING'"
            [class.bg-toffee-brown]="status() === 'READING'"
            [class.bg-dusty-olive]="status() === 'FINISHED'"
          >
            {{ status() | readingStatusLabel }}
          </span>
        </div>
        <div class="flex flex-1 flex-col p-4">
          <h3 class="line-clamp-2 font-semibold leading-snug">{{ book().title }}</h3>
          <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">{{ book().author }}</p>
          @if (book().sagaName) {
            <p class="mt-0.5 truncate text-xs font-medium text-primary-600 dark:text-primary-400">
              {{ book().sagaName }}@if (book().sagaOrder) {&nbsp;· #{{ book().sagaOrder }}}
            </p>
          }
          <!-- Valoración en su propia fila: no compite por espacio con tipo y badge -->
          @if (book().session?.rating) {
            <div class="mt-auto pt-3">
              <app-star-rating [rating]="book().session!.rating!" [readonly]="true" />
            </div>
          }
          <div
            class="flex items-center gap-1.5 text-xs text-slate-400"
            [class.mt-auto]="!book().session?.rating"
            [class.pt-3]="!book().session?.rating"
            [class.mt-1]="!!book().session?.rating"
          >
            <span>{{ book().type | bookTypeLabel }}</span>
            @if (book().ebookFormat) {
              <span
                class="inline-flex items-center gap-0.5 rounded-full bg-primary-100 px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase text-primary-700 dark:bg-primary-900/50 dark:text-primary-300"
                [title]="'Incluye ' + book().ebookFormat"
              >
                <app-icon name="document-text" [size]="11" [strokeWidth]="2" />
                {{ book().ebookFormat }}
              </span>
            }
          </div>
        </div>
      </a>
    </article>
  `
})
export class BookCardComponent {
  private readonly bookService = inject(BookService);

  readonly book = input.required<Book>();

  protected readonly cover = computed(() => this.bookService.coverUrl(this.book()));
  protected readonly status = computed(() => this.book().session?.status ?? 'PENDING');
}

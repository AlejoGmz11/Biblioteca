import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Book } from '../../core/models';
import { BookService } from '../../core/services/book.service';
import { ReadingStatusLabelPipe } from '../pipes/reading-status-label.pipe';
import { StarRatingComponent } from './star-rating.component';
import { IconComponent } from './icon.component';

/** Pairs of gradient stops, one per slot mod palette length. */
const COVER_GRADIENTS: [string, string][] = [
  ['#8c6e3f', '#5c3a1a'],
  ['#4a7c59', '#2d5a3a'],
  ['#5c6b3a', '#3d4a26'],
  ['#a0522d', '#7a3a1f'],
  ['#b08040', '#8c5820'],
  ['#3d3222', '#1c1510'],
  ['#7a5e31', '#5a3e18'],
  ['#8fa882', '#5a7a5a'],
];

@Component({
  selector: 'app-book-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, ReadingStatusLabelPipe, StarRatingComponent, IconComponent],
  template: `
    <article
      class="card group flex h-full flex-col overflow-hidden
             transition-all duration-150 hover:-translate-y-0.5 hover:shadow-lg"
    >
      <a
        [routerLink]="['/books', book().id]"
        class="flex h-full flex-col"
        [attr.aria-label]="'Ver detalle de ' + book().title"
      >
        <!-- Cover -->
        <div class="relative aspect-[2/3] w-full overflow-hidden">
          @if (cover()) {
            <img
              [src]="cover()"
              [alt]="'Portada de ' + book().title"
              loading="lazy"
              class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          } @else {
            <!-- Gradient placeholder with initial -->
            <div
              class="flex h-full w-full items-center justify-center"
              [style.background]="'linear-gradient(145deg,' + gradient()[0] + ',' + gradient()[1] + ')'"
              aria-hidden="true"
            >
              <span class="select-none text-5xl font-bold text-white/30">
                {{ book().title.charAt(0).toUpperCase() }}
              </span>
            </div>
          }

          <!-- Status badge -->
          <span
            class="absolute left-2 top-2 rounded-full px-2 py-0.5 text-xs font-semibold shadow-sm"
            [class.bg-slate-700]="status() === 'PENDING'"
            [class.text-slate-200]="status() === 'PENDING'"
            [class.bg-toffee-brown]="status() === 'READING'"
            [class.text-amber-100]="status() === 'READING'"
            [class.bg-dusty-olive]="status() === 'FINISHED'"
            [class.text-green-100]="status() === 'FINISHED'"
          >{{ status() | readingStatusLabel }}</span>

          <!-- READING: progress overlay at bottom of cover -->
          @if (status() === 'READING' && progressPct() !== null) {
            <div class="absolute inset-x-0 bottom-0 h-1 bg-black/30">
              <div
                class="h-full bg-toffee-brown transition-all"
                [style.width.%]="progressPct()"
              ></div>
            </div>
          }
        </div>

        <!-- Info -->
        <div class="flex flex-1 flex-col gap-1 p-3">
          <h3 class="line-clamp-2 text-sm font-semibold leading-snug">{{ book().title }}</h3>
          <p class="truncate text-xs text-slate-500 dark:text-slate-400">{{ book().author }}</p>

          @if (book().sagaName) {
            <p class="truncate text-xs font-medium text-primary-600 dark:text-primary-400">
              {{ book().sagaName }}@if (book().sagaOrder) {&nbsp;· #{{ book().sagaOrder }}}
            </p>
          }

          <!-- Reading progress text -->
          @if (status() === 'READING' && progressPct() !== null) {
            <p class="mt-auto pt-2 text-xs text-slate-400 dark:text-slate-500">
              Pág. {{ book().session!.currentPage }} / {{ book().pages }}
              <span class="text-toffee-brown font-medium"> · {{ progressPct() }}%</span>
            </p>
          }

          <!-- Finished: rating + pages -->
          @if (status() === 'FINISHED') {
            <div class="mt-auto flex items-center justify-between pt-2">
              @if (book().session?.rating) {
                <app-star-rating [rating]="book().session!.rating!" [readonly]="true" />
              } @else {
                <span class="text-xs text-slate-400">Sin valorar</span>
              }
              @if (book().pages) {
                <span class="text-xs text-slate-400">{{ book().pages }}p</span>
              }
            </div>
          }

          <!-- Pending: pages + ebook badge -->
          @if (status() === 'PENDING') {
            <div class="mt-auto flex items-center gap-1.5 pt-2 text-xs text-slate-400">
              @if (book().pages) {
                <span>{{ book().pages }} págs.</span>
              }
              @if (book().ebookFormat) {
                <span
                  class="inline-flex items-center gap-0.5 rounded-full bg-primary-100 px-1.5 py-0.5
                         text-[0.6rem] font-semibold uppercase text-primary-700
                         dark:bg-primary-900/50 dark:text-primary-300"
                >
                  <app-icon name="document-text" [size]="10" [strokeWidth]="2" />
                  {{ book().ebookFormat }}
                </span>
              }
            </div>
          }
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

  protected readonly progressPct = computed((): number | null => {
    const b = this.book();
    const cur = b.session?.currentPage;
    const total = b.pages;
    if (!cur || !total || total <= 0) return null;
    return Math.min(100, Math.round((cur / total) * 100));
  });

  protected readonly gradient = computed((): [string, string] => {
    let hash = 0;
    for (const ch of this.book().title) {
      hash = (hash + ch.charCodeAt(0)) % COVER_GRADIENTS.length;
    }
    return COVER_GRADIENTS[hash];
  });
}

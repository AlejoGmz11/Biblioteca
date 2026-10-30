import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Book } from '../../core/models';
import { BookTypeLabelPipe } from '../pipes/book-type-label.pipe';
import { ReadingStatusLabelPipe } from '../pipes/reading-status-label.pipe';
import { IconComponent } from './icon.component';

@Component({
  selector: 'app-book-table',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, BookTypeLabelPipe, ReadingStatusLabelPipe, IconComponent],
  template: `
    <div class="card overflow-x-auto">
      <table class="w-full text-left text-sm">
        <caption class="sr-only">Listado de libros de tu biblioteca</caption>
        <thead class="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-slate-800 dark:text-slate-400">
          <tr>
            <th scope="col" class="px-4 py-3">Título</th>
            <th scope="col" class="px-4 py-3">Autor</th>
            <th scope="col" class="hidden px-4 py-3 md:table-cell">Categorías</th>
            <th scope="col" class="hidden px-4 py-3 sm:table-cell">Tipo</th>
            <th scope="col" class="px-4 py-3">Estado</th>
            <th scope="col" class="px-4 py-3"><span class="sr-only">Acciones</span></th>
          </tr>
        </thead>
        <tbody>
          @for (book of books(); track book.id) {
            <tr class="border-b border-slate-100 last:border-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50">
              <td class="px-4 py-3 font-medium">
                <a [routerLink]="['/books', book.id]" class="hover:text-primary-600 dark:hover:text-primary-400">
                  {{ book.title }}
                </a>
                @if (book.sagaName) {
                  <p class="mt-0.5 text-xs font-normal text-primary-600 dark:text-primary-400">
                    {{ book.sagaName }}@if (book.sagaOrder) {&nbsp;· #{{ book.sagaOrder }}}
                  </p>
                }
                @if (book.ebookFormat) {
                  <span
                    class="mt-1 inline-flex items-center gap-0.5 rounded-full bg-primary-100 px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase text-primary-700 dark:bg-primary-900/50 dark:text-primary-300"
                    [title]="'Incluye ' + book.ebookFormat"
                  >
                    <app-icon name="document-text" [size]="11" [strokeWidth]="2" />
                    {{ book.ebookFormat }}
                  </span>
                }
              </td>
              <td class="px-4 py-3 text-slate-500 dark:text-slate-400">{{ book.author }}</td>
              <td class="hidden px-4 py-3 text-slate-500 dark:text-slate-400 md:table-cell">
                {{ categoryNames(book) }}
              </td>
              <td class="hidden px-4 py-3 text-slate-500 dark:text-slate-400 sm:table-cell">
                {{ book.type | bookTypeLabel }}
              </td>
              <td class="px-4 py-3">
                <span
                  class="rounded-full px-2 py-0.5 text-xs font-medium"
                  [class]="statusClasses(book)"
                >
                  {{ book.session?.status | readingStatusLabel }}
                </span>
              </td>
              <td class="px-4 py-3 text-right">
                <a
                  [routerLink]="['/books', book.id, 'edit']"
                  class="mr-2 text-primary-600 hover:underline dark:text-primary-400"
                  [attr.aria-label]="'Editar ' + book.title"
                >
                  Editar
                </a>
                <button
                  type="button"
                  class="text-red-600 hover:underline dark:text-red-400"
                  (click)="deleteRequest.emit(book)"
                  [attr.aria-label]="'Eliminar ' + book.title"
                >
                  Eliminar
                </button>
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  `
})
export class BookTableComponent {
  readonly books = input.required<Book[]>();
  readonly deleteRequest = output<Book>();

  categoryNames(book: Book): string {
    return book.categories.length ? book.categories.map((c) => c.name).join(', ') : '—';
  }

  statusClasses(book: Book): string {
    switch (book.session?.status) {
      case 'READING':
        return 'bg-primary-100 text-primary-700 dark:bg-primary-900/60 dark:text-primary-300';
      case 'FINISHED':
        return 'bg-dry-sage text-charcoal-brown dark:bg-dusty-olive/60 dark:text-dry-sage';
      default:
        return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
    }
  }
}

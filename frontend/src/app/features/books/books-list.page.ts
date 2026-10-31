import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { Book, BookFilters, Category, PageResponse, Saga } from '../../core/models';
import { BookService } from '../../core/services/book.service';
import { CategoryService } from '../../core/services/category.service';
import { SagaService } from '../../core/services/saga.service';
import { SeoService } from '../../core/services/seo.service';
import { ToastService } from '../../core/services/toast.service';
import { BookCardComponent } from '../../shared/components/book-card.component';
import { BookTableComponent } from '../../shared/components/book-table.component';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog.component';
import { FilterPanelComponent } from '../../shared/components/filter-panel.component';
import { PaginationComponent } from '../../shared/components/pagination.component';
import { SearchBarComponent } from '../../shared/components/search-bar.component';
import { IconComponent } from '../../shared/components/icon.component';

@Component({
  selector: 'app-books-list-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    BookCardComponent,
    BookTableComponent,
    ConfirmDialogComponent,
    FilterPanelComponent,
    PaginationComponent,
    SearchBarComponent,
    IconComponent
  ],
  template: `
    <section aria-labelledby="books-title">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <h1 id="books-title" class="text-2xl font-bold">Mis libros</h1>
        <div class="flex items-center gap-2">
          <div class="flex rounded-lg border border-slate-300 dark:border-slate-700" role="group" aria-label="Modo de vista">
            <button
              type="button"
              class="rounded-l-lg px-3 py-2 text-sm"
              [class.bg-primary-600]="view() === 'cards'"
              [class.text-white]="view() === 'cards'"
              [attr.aria-pressed]="view() === 'cards'"
              (click)="view.set('cards')"
            >
              Tarjetas
            </button>
            <button
              type="button"
              class="rounded-r-lg px-3 py-2 text-sm"
              [class.bg-primary-600]="view() === 'table'"
              [class.text-white]="view() === 'table'"
              [attr.aria-pressed]="view() === 'table'"
              (click)="view.set('table')"
            >
              Tabla
            </button>
          </div>
          <a routerLink="/books/new" class="btn-primary">+ Añadir</a>
        </div>
      </div>

      <div class="mt-4 space-y-4">
        <app-search-bar (search)="onSearch($event)" />
        <app-filter-panel [categories]="categories()" [sagas]="sagas()" (filtersChange)="onFilters($event)" />
      </div>

      <div class="mt-6" aria-live="polite">
        @if (page(); as result) {
          @if (result.content.length === 0) {
            <div class="card p-12 text-center">
              <span class="inline-flex text-slate-300 dark:text-slate-600" aria-hidden="true">
                <app-icon name="book-open" [size]="48" [strokeWidth]="1.2" />
              </span>
              <p class="mt-3 font-medium">No se encontraron libros</p>
              <p class="mt-1 text-sm text-slate-500">Prueba con otros filtros o añade tu primer libro.</p>
            </div>
          } @else if (view() === 'cards') {
            <ul class="grid list-none grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6" role="list">
              @for (book of result.content; track book.id) {
                <li><app-book-card [book]="book" /></li>
              }
            </ul>
          } @else {
            <app-book-table [books]="result.content" (deleteRequest)="toDelete.set($event)" />
          }

          <div class="mt-6">
            <app-pagination
              [page]="result.page"
              [totalPages]="result.totalPages"
              (pageChange)="onPage($event)"
            />
          </div>
        } @else if (loadError()) {
          <div class="card p-8 text-center" role="alert">
            <span class="inline-flex text-camel" aria-hidden="true">
              <app-icon name="warning" [size]="32" />
            </span>
            <p class="mt-2 font-medium">No se pudieron cargar tus libros</p>
            <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Comprueba que el servidor esté disponible e inténtalo de nuevo.
            </p>
            <button type="button" class="btn-primary mt-4" (click)="retry()">Reintentar</button>
          </div>
        } @else {
          <p class="text-slate-500" role="status">Cargando libros…</p>
        }
      </div>
    </section>

    <app-confirm-dialog
      [open]="toDelete() !== null"
      title="Eliminar libro"
      [message]="'¿Seguro que quieres eliminar «' + (toDelete()?.title ?? '') + '»? Se perderá también su sesión de lectura.'"
      (confirmed)="confirmDelete()"
      (cancelled)="toDelete.set(null)"
    />
  `
})
export class BooksListPage {
  private readonly bookService = inject(BookService);
  private readonly categoryService = inject(CategoryService);
  private readonly sagaService = inject(SagaService);
  private readonly toast = inject(ToastService);

  protected readonly page = signal<PageResponse<Book> | null>(null);
  protected readonly loadError = signal(false);
  protected readonly categories = signal<Category[]>([]);
  protected readonly sagas = signal<Saga[]>([]);
  protected readonly view = signal<'cards' | 'table'>('cards');
  protected readonly toDelete = signal<Book | null>(null);

  private filters: BookFilters = { page: 0, size: 12 };

  constructor() {
    inject(SeoService).apply({
      title: 'Mis libros — MyLibrary',
      description: 'Explora, filtra y gestiona todos los libros de tu biblioteca personal.',
      path: '/books'
    });
    this.categoryService.list().subscribe((categories) => this.categories.set(categories));
    this.sagaService.list().subscribe((sagas) => this.sagas.set(sagas));

    const searchParam = inject(ActivatedRoute).snapshot.queryParamMap.get('search');
    if (searchParam) this.filters = { ...this.filters, search: searchParam };
    this.load();
  }

  onSearch(term: string): void {
    this.filters = { ...this.filters, search: term, page: 0 };
    this.load();
  }

  onFilters(partial: Partial<BookFilters>): void {
    this.filters = { ...this.filters, ...partial, page: 0 };
    this.load();
  }

  onPage(page: number): void {
    this.filters = { ...this.filters, page };
    this.load();
  }

  confirmDelete(): void {
    const book = this.toDelete();
    if (!book) {
      return;
    }
    this.bookService.delete(book.id).subscribe({
      next: () => {
        this.toDelete.set(null);
        this.toast.success(`«${book.title}» eliminado`);
        this.load();
      },
      error: () => {
        this.toDelete.set(null);
        this.toast.error('No se pudo eliminar el libro');
      }
    });
  }

  retry(): void {
    this.loadError.set(false);
    this.load();
  }

  private load(): void {
    this.bookService.list(this.filters).subscribe({
      next: (page) => this.page.set(page),
      error: () => {
        this.page.set(null);
        this.loadError.set(true);
      }
    });
  }
}

import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal
} from '@angular/core';
import { RouterLink, ActivatedRoute } from '@angular/router';
import {
  Book,
  BookFilters,
  Category,
  PageResponse,
  ReadingStatus,
  Saga
} from '../../core/models';
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

type StatusFilter = ReadingStatus | '';

const STATUS_CHIPS: { label: string; value: StatusFilter; dot: string }[] = [
  { label: 'Todos',       value: '',         dot: 'bg-slate-400' },
  { label: 'Pendientes',  value: 'PENDING',  dot: 'bg-slate-500' },
  { label: 'Leyendo',     value: 'READING',  dot: 'bg-toffee-brown' },
  { label: 'Terminados',  value: 'FINISHED', dot: 'bg-dusty-olive' },
];

// Columnas del grid por ancho de pantalla (mismos cortes que los breakpoints de Tailwind).
const GRID_BREAKPOINTS = [
  { minWidth: 1536, columns: 6 },
  { minWidth: 1280, columns: 5 },
  { minWidth: 1024, columns: 4 },
  { minWidth: 640, columns: 3 }
] as const;
const GRID_MIN_COLUMNS = 2;
const GRID_SSR_COLUMNS = 4;
// Libros por página = columnas × filas, así cada página llena termina en una fila completa.
const GRID_ROWS = 3;

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

      <!-- ── Header ── -->
      <div class="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 id="books-title" class="text-2xl font-bold font-serif">Mis libros</h1>
          <p class="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            @if (page(); as result) {
              {{ result.totalElements }} libros en tu biblioteca
            } @else {
              &nbsp;
            }
          </p>
        </div>
        <a routerLink="/books/new" class="btn-primary flex items-center gap-1.5">
          <app-icon name="plus" [size]="16" />
          Añadir libro
        </a>
      </div>

      <!-- ── Toolbar ── -->
      <div class="mb-4 flex flex-wrap items-center gap-2">

        <!-- Search -->
        <div class="flex-1" style="min-width:180px; max-width:300px;">
          <app-search-bar [initialValue]="initialSearch" (search)="onSearch($event)" />
        </div>

        <!-- Status chips -->
        <div class="flex gap-1" role="group" aria-label="Filtrar por estado">
          @for (chip of STATUS_CHIPS; track chip.value) {
            <button
              type="button"
              class="status-chip"
              [class.active]="activeStatus() === chip.value"
              (click)="setStatus(chip.value)"
              [attr.aria-pressed]="activeStatus() === chip.value"
            >
              <span class="h-1.5 w-1.5 rounded-full" [class]="chip.dot"></span>
              {{ chip.label }}
            </button>
          }
        </div>

        <!-- Spacer -->
        <div class="flex-1 hidden sm:block"></div>

        <!-- More filters toggle -->
        <button
          type="button"
          class="filter-btn flex items-center gap-1.5"
          [class.active]="showFilters()"
          (click)="showFilters.set(!showFilters())"
          [attr.aria-expanded]="showFilters()"
          aria-controls="advanced-filters"
        >
          <app-icon name="bars-arrow-down" [size]="14" />
          Filtros
          @if (hasAdvancedFilters()) {
            <span class="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full
                         bg-primary-500 text-[0.65rem] font-bold text-white">
              {{ advancedFilterCount() }}
            </span>
          }
        </button>

        <!-- View toggle -->
        <div
          class="flex overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700"
          role="group"
          aria-label="Modo de vista"
        >
          <button
            type="button"
            class="px-3 py-1.5 text-sm transition-colors"
            [class.bg-primary-600]="view() === 'cards'"
            [class.text-white]="view() === 'cards'"
            [class.text-slate-500]="view() !== 'cards'"
            [attr.aria-pressed]="view() === 'cards'"
            (click)="view.set('cards')"
            aria-label="Vista tarjetas"
          ><app-icon name="view-columns" [size]="16" /></button>
          <button
            type="button"
            class="px-3 py-1.5 text-sm transition-colors"
            [class.bg-primary-600]="view() === 'table'"
            [class.text-white]="view() === 'table'"
            [class.text-slate-500]="view() !== 'table'"
            [attr.aria-pressed]="view() === 'table'"
            (click)="view.set('table')"
            aria-label="Vista tabla"
          ><app-icon name="list" [size]="16" /></button>
        </div>
      </div>

      <!-- ── Advanced filters (collapsible) ── -->
      @if (showFilters()) {
        <div
          id="advanced-filters"
          class="mb-4 rounded-xl border border-slate-200 bg-slate-50/80 p-4
                 backdrop-blur-sm dark:border-slate-700 dark:bg-slate-800/50"
        >
          <app-filter-panel
            [categories]="categories()"
            [sagas]="sagas()"
            (filtersChange)="onAdvancedFilters($event)"
          />
        </div>
      }

      <!-- ── Content ── -->
      <div aria-live="polite">
        @if (page(); as result) {
          @if (result.content.length === 0) {
            <div class="card flex flex-col items-center px-6 py-16 text-center">
              <span class="text-slate-200 dark:text-slate-700" aria-hidden="true">
                <app-icon name="book-open" [size]="52" [strokeWidth]="1.2" />
              </span>
              <p class="mt-4 font-semibold">No se encontraron libros</p>
              <p class="mt-1 text-sm text-slate-500">Probá con otros filtros o añadí tu primer libro.</p>
              <a routerLink="/books/new" class="btn-primary mt-5">Añadir libro</a>
            </div>
          } @else if (view() === 'cards') {
            <ul
              class="grid list-none gap-3"
              [style.grid-template-columns]="gridTemplate()"
              role="list"
            >
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
            <p class="mt-2 font-medium">No se pudieron cargar los libros</p>
            <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Verificá que el servidor esté disponible e intentá de nuevo.
            </p>
            <button type="button" class="btn-primary mt-4" (click)="retry()">Reintentar</button>
          </div>
        } @else {
          <!-- Skeleton grid -->
          <ul
            class="grid list-none gap-3"
            [style.grid-template-columns]="gridTemplate()"
            aria-label="Cargando libros…"
            role="list"
          >
            @for (_ of skeletons(); track $index) {
              <li>
                <div class="card overflow-hidden">
                  <div class="aspect-[2/3] w-full animate-pulse bg-slate-200 dark:bg-slate-700"></div>
                  <div class="space-y-2 p-3">
                    <div class="h-3 w-3/4 animate-pulse rounded bg-slate-200 dark:bg-slate-700"></div>
                    <div class="h-3 w-1/2 animate-pulse rounded bg-slate-100 dark:bg-slate-800"></div>
                  </div>
                </div>
              </li>
            }
          </ul>
        }
      </div>
    </section>

    <app-confirm-dialog
      [open]="toDelete() !== null"
      title="Eliminar libro"
      [message]="'¿Seguro que querés eliminar «' + (toDelete()?.title ?? '') + '»? Se perderá también su sesión de lectura.'"
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
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly STATUS_CHIPS = STATUS_CHIPS;

  private readonly gridColumns = signal(GRID_SSR_COLUMNS);
  private readonly pageSize = computed(() => this.gridColumns() * GRID_ROWS);
  protected readonly gridTemplate = computed(
    () => `repeat(${this.gridColumns()}, minmax(0, 1fr))`
  );
  protected readonly skeletons = computed(() => Array.from({ length: this.pageSize() }));

  protected readonly page = signal<PageResponse<Book> | null>(null);
  protected readonly loadError = signal(false);
  protected readonly categories = signal<Category[]>([]);
  protected readonly sagas = signal<Saga[]>([]);
  protected readonly view = signal<'cards' | 'table'>('cards');
  protected readonly toDelete = signal<Book | null>(null);
  protected readonly activeStatus = signal<StatusFilter>('');
  protected readonly showFilters = signal(false);

  /** Tracks advanced filter values to show the badge count. */
  private advancedFilters: Partial<BookFilters> = {};

  protected readonly hasAdvancedFilters = computed(() =>
    Object.values(this.advancedFilters).some((v) => v !== '' && v != null)
  );

  protected readonly advancedFilterCount = computed(() =>
    Object.values(this.advancedFilters).filter((v) => v !== '' && v != null).length
  );

  protected initialSearch = '';
  private filters: BookFilters = { page: 0 };

  constructor() {
    inject(SeoService).apply({
      title: 'Mis libros — MyLibrary',
      description: 'Explorá, filtrá y gestioná todos los libros de tu biblioteca personal.',
      path: '/books'
    });
    this.categoryService.list().subscribe((categories) => this.categories.set(categories));
    this.sagaService.list().subscribe((sagas) => this.sagas.set(sagas));

    const searchParam = inject(ActivatedRoute).snapshot.queryParamMap.get('search');
    if (searchParam) {
      this.initialSearch = searchParam;
      this.filters = { ...this.filters, search: searchParam };
    }
    this.watchGridColumns();
    this.load();
  }

  protected setStatus(value: StatusFilter): void {
    this.activeStatus.set(value);
    this.filters = { ...this.filters, status: value, page: 0 };
    this.load();
  }

  onSearch(term: string): void {
    this.filters = { ...this.filters, search: term, page: 0 };
    this.load();
  }

  onAdvancedFilters(partial: Partial<BookFilters>): void {
    this.advancedFilters = { ...this.advancedFilters, ...partial };
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

  private watchGridColumns(): void {
    const win = this.document.defaultView;
    if (!win?.matchMedia) {
      return;
    }
    const queries = GRID_BREAKPOINTS.map(({ minWidth, columns }) => ({
      columns,
      list: win.matchMedia(`(min-width: ${minWidth}px)`)
    }));
    const currentColumns = () =>
      queries.find((q) => q.list.matches)?.columns ?? GRID_MIN_COLUMNS;

    this.gridColumns.set(currentColumns());

    const onChange = () => this.changeColumns(currentColumns());
    queries.forEach((q) => q.list.addEventListener('change', onChange));
    this.destroyRef.onDestroy(() =>
      queries.forEach((q) => q.list.removeEventListener('change', onChange))
    );
  }

  private changeColumns(columns: number): void {
    if (columns === this.gridColumns()) {
      return;
    }
    // Conserva el primer libro visible al cambiar el tamaño de página.
    const firstIndex = (this.filters.page ?? 0) * this.pageSize();
    this.gridColumns.set(columns);
    this.filters = { ...this.filters, page: Math.floor(firstIndex / this.pageSize()) };
    this.load();
  }

  private load(): void {
    this.page.set(null);
    this.loadError.set(false);
    this.bookService.list({ ...this.filters, size: this.pageSize() }).subscribe({
      next: (page) => this.page.set(page),
      error: () => {
        this.page.set(null);
        this.loadError.set(true);
      }
    });
  }
}

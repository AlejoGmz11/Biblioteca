import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { Book, SessionPatch } from '../../core/models';
import { BookService } from '../../core/services/book.service';
import { EbookService } from '../../core/services/ebook.service';
import { EbookCacheService } from '../../core/services/ebook-cache.service';
import { SeoService } from '../../core/services/seo.service';
import { ThemeService } from '../../core/services/theme.service';
import { ToastService } from '../../core/services/toast.service';
import { IconComponent } from '../../shared/components/icon.component';
import { EpubReaderComponent, EpubTocItem, ReadingProgress } from './epub-reader.component';
import { PdfChapter, PdfReaderComponent } from './pdf-reader.component';

/**
 * Lector a pantalla completa. Descarga el archivo (a través del interceptor
 * JWT), elige el visor según el formato y sincroniza el progreso con la
 * sesión de lectura: página actual para PDF, ubicación CFI para EPUB.
 */
@Component({
  selector: 'app-reader-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IconComponent, PdfReaderComponent, EpubReaderComponent],
  host: {
    '(window:keydown)': 'onKeydown($event)'
  },
  template: `
    <div class="fixed inset-0 z-40 flex flex-col bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <!-- Barra superior -->
      <header
        role="toolbar"
        aria-label="Controles del lector"
        class="flex flex-wrap items-center gap-1 border-b border-slate-200 bg-white/95 px-2 py-1.5 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 sm:gap-2 sm:px-4"
      >
        <a [routerLink]="['/books', id()]" class="btn-secondary !px-2" aria-label="Volver al libro">
          <app-icon name="arrow-left" [size]="18" />
        </a>
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-semibold">{{ book()?.title ?? 'Cargando…' }}</p>
          @if (chapter()) {
            <p class="truncate text-xs text-slate-500 dark:text-slate-400">{{ chapter() }}</p>
          }
        </div>

        @if (book()?.ebookFormat === 'PDF') {
          <div class="flex items-center gap-1" aria-label="Navegación de páginas">
            <button type="button" class="btn-secondary !px-2" (click)="goToPage(page() - 1)" [disabled]="page() <= 1" aria-label="Página anterior">
              <app-icon name="chevron-left" [size]="16" />
            </button>
            <label class="sr-only" for="page-input">Página actual</label>
            <input
              id="page-input"
              type="number"
              class="input !w-16 !py-1 text-center text-sm"
              [value]="page()"
              min="1"
              [max]="totalPages()"
              (change)="onPageInput($event)"
            />
            <span class="text-xs text-slate-500" aria-live="polite">/ {{ totalPages() || '…' }}</span>
            <button type="button" class="btn-secondary !px-2" (click)="goToPage(page() + 1)" [disabled]="page() >= totalPages()" aria-label="Página siguiente">
              <app-icon name="chevron-right" [size]="16" />
            </button>
          </div>
          <div class="hidden items-center gap-1 sm:flex" aria-label="Zoom">
            <button type="button" class="btn-secondary !px-2" (click)="zoomBy(-0.2)" [disabled]="zoom() <= 0.6" aria-label="Reducir">
              <app-icon name="minus" [size]="16" />
            </button>
            <button type="button" class="btn-secondary !px-2 text-xs" (click)="zoom.set(1)" aria-label="Ajustar al ancho">
              <app-icon name="arrows-expand" [size]="16" />
            </button>
            <button type="button" class="btn-secondary !px-2" (click)="zoomBy(0.2)" [disabled]="zoom() >= 3" aria-label="Ampliar">
              <app-icon name="plus" [size]="16" />
            </button>
          </div>
          <button
            type="button"
            class="btn-secondary !px-2"
            (click)="toggleMode()"
            [attr.aria-pressed]="mode() === 'scroll'"
            [attr.aria-label]="mode() === 'scroll' ? 'Cambiar a modo página' : 'Cambiar a desplazamiento continuo'"
          >
            <app-icon [name]="mode() === 'scroll' ? 'view-columns' : 'bars-arrow-down'" [size]="16" />
          </button>
        }

        @if (book()?.ebookFormat === 'EPUB') {
          <div class="flex items-center gap-1" aria-label="Navegación">
            <button type="button" class="btn-secondary !px-2" (click)="epub()?.prev()" aria-label="Anterior">
              <app-icon name="chevron-left" [size]="16" />
            </button>
            <button type="button" class="btn-secondary !px-2" (click)="epub()?.next()" aria-label="Siguiente">
              <app-icon name="chevron-right" [size]="16" />
            </button>
          </div>
          <div class="hidden items-center gap-1 sm:flex" aria-label="Tamaño de letra">
            <button type="button" class="btn-secondary !px-2" (click)="fontBy(-10)" [disabled]="fontSize() <= 70" aria-label="Letra más pequeña">
              <app-icon name="minus" [size]="16" />
            </button>
            <span class="w-10 text-center text-xs text-slate-500">{{ fontSize() }}%</span>
            <button type="button" class="btn-secondary !px-2" (click)="fontBy(10)" [disabled]="fontSize() >= 200" aria-label="Letra más grande">
              <app-icon name="plus" [size]="16" />
            </button>
          </div>
          <button
            type="button"
            class="btn-secondary !px-2"
            (click)="tocOpen.set(!tocOpen())"
            [attr.aria-expanded]="tocOpen()"
            aria-controls="reader-toc"
            aria-label="Índice"
          >
            <app-icon name="list" [size]="16" />
          </button>
        }

        <button
          type="button"
          class="btn-secondary !px-2"
          (click)="theme.toggle()"
          [attr.aria-label]="theme.darkMode() ? 'Activar modo claro' : 'Activar modo oscuro'"
        >
          <app-icon [name]="theme.darkMode() ? 'sun' : 'moon'" [size]="16" />
        </button>
        <button type="button" class="btn-secondary !px-2" (click)="download()" [disabled]="downloading()" aria-label="Descargar archivo">
          <app-icon name="download" [size]="16" />
        </button>
      </header>

      <!-- Área de lectura -->
      <div class="relative min-h-0 flex-1 bg-slate-200 dark:bg-slate-900">
        @if (error()) {
          <div class="flex h-full flex-col items-center justify-center gap-3 p-6 text-center" role="alert">
            <span class="text-camel" aria-hidden="true"><app-icon name="warning" [size]="32" /></span>
            <p class="font-medium">{{ error() }}</p>
            <a [routerLink]="['/books', id()]" class="btn-primary">Volver al libro</a>
          </div>
        } @else if (!data()) {
          <div class="flex h-full items-center justify-center p-6" role="status" aria-live="polite">
            <p class="text-sm text-slate-500">Descargando el libro… {{ progress() }}</p>
          </div>
        } @else if (book()?.ebookFormat === 'PDF') {
          <!-- "Página" vertical centrada, como en Apple Books: el documento nunca se estira a todo el ancho -->
          <div class="mx-auto h-full w-full max-w-[46rem] sm:px-3 sm:py-3">
            <div class="h-full overflow-hidden bg-[#fbfaf5] shadow-xl dark:bg-[#1d2318] sm:rounded-xl">
              <app-pdf-reader
                [data]="data()!"
                [mode]="mode()"
                [zoom]="zoom()"
                [(page)]="page"
                (totalPages)="totalPages.set($event)"
                (outlineLoaded)="pdfChapters.set($event)"
              />
            </div>
          </div>
        } @else if (book()?.ebookFormat === 'EPUB') {
          <div class="mx-auto h-full w-full max-w-[46rem] sm:px-3 sm:py-3">
            <div class="h-full overflow-hidden bg-[#fbfaf5] shadow-xl dark:bg-[#1d2318] sm:rounded-xl">
              <app-epub-reader
                #epubReader
                [data]="data()!"
                [initialLocation]="initialEpubLocation()"
                [dark]="theme.darkMode()"
                [fontSize]="fontSize()"
                (locationChange)="onLocation($event)"
                (chapterChange)="chapter.set($event)"
                (tocLoaded)="toc.set($event)"
                (progressChange)="epubProgress.set($event)"
                [cacheKey]="id()"
              />
            </div>
          </div>

          <!-- Índice EPUB -->
          @if (tocOpen()) {
            <nav
              id="reader-toc"
              aria-label="Índice del libro"
              class="absolute inset-y-0 left-0 z-10 w-72 max-w-[85vw] overflow-y-auto border-r border-slate-200 bg-white p-3 shadow-xl dark:border-slate-800 dark:bg-slate-900"
            >
              <div class="mb-2 flex items-center justify-between">
                <p class="text-sm font-semibold">Índice</p>
                <button type="button" class="btn-secondary !p-1" (click)="tocOpen.set(false)" aria-label="Cerrar índice">
                  <app-icon name="x-mark" [size]="14" />
                </button>
              </div>
              @if (toc().length === 0) {
                <p class="text-xs text-slate-500">Este libro no incluye índice.</p>
              }
              <ul class="space-y-0.5" role="list">
                @for (item of toc(); track $index) {
                  <li>
                    <button
                      type="button"
                      class="w-full rounded px-2 py-1 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                      [style.padding-left.rem]="0.5 + item.level * 0.75"
                      (click)="goToChapter(item)"
                    >
                      {{ item.label }}
                    </button>
                  </li>
                }
              </ul>
            </nav>
          }
        }
      </div>

      <!-- Pie de progreso, como en Apple Books -->
      @if (data() && !error()) {
        <footer
          class="border-t border-slate-200 bg-white/95 px-4 py-1.5 text-xs text-slate-500 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 dark:text-slate-400"
          aria-live="polite"
        >
          @if (progressPercent() !== null) {
            <div class="mx-auto mb-1.5 h-1 w-full max-w-[46rem] overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700" aria-hidden="true">
              <div class="h-full rounded-full bg-primary-500 transition-[width] duration-300" [style.width.%]="progressPercent()"></div>
            </div>
          }
          <div class="mx-auto flex w-full max-w-[46rem] items-center justify-between gap-3">
            <span class="min-w-0 truncate">{{ chapterLeftLabel() }}</span>
            <span class="shrink-0 font-medium text-slate-700 dark:text-slate-200">{{ pageLabel() }}</span>
            <span class="w-12 shrink-0 text-right">{{ progressPercent() !== null ? progressPercent() + ' %' : '' }}</span>
          </div>
        </footer>
      }
    </div>
  `
})
export class ReaderPage {
  private readonly bookService = inject(BookService);
  private readonly ebookService = inject(EbookService);
  private readonly ebookCache = inject(EbookCacheService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly seo = inject(SeoService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly theme = inject(ThemeService);

  readonly id = input.required<string>();

  protected readonly book = signal<Book | null>(null);
  protected readonly data = signal<ArrayBuffer | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly progress = signal('');
  protected readonly downloading = signal(false);

  // PDF
  protected readonly page = signal(1);
  protected readonly totalPages = signal(0);
  protected readonly zoom = signal(1);
  protected readonly mode = signal<'page' | 'scroll'>('page');

  // EPUB
  protected readonly fontSize = signal(100);
  protected readonly chapter = signal<string | null>(null);
  protected readonly toc = signal<EpubTocItem[]>([]);
  protected readonly tocOpen = signal(false);
  protected readonly epub = viewChild<EpubReaderComponent>('epubReader');

  protected readonly isPdf = computed(() => this.book()?.ebookFormat === 'PDF');

  // Progreso (pie estilo Apple Books)
  protected readonly pdfChapters = signal<PdfChapter[]>([]);
  protected readonly epubProgress = signal<ReadingProgress | null>(null);

  /** Porcentaje leído: páginas reales (PDF) o localizaciones (EPUB). */
  protected readonly progressPercent = computed(() => {
    if (this.isPdf()) {
      const total = this.totalPages();
      return total ? Math.round((this.page() / total) * 100) : null;
    }
    return this.epubProgress()?.percentage ?? null;
  });

  protected readonly pageLabel = computed(() => {
    if (this.isPdf()) {
      return this.totalPages() ? `Página ${this.page()} de ${this.totalPages()}` : '';
    }
    const p = this.epubProgress();
    return p?.page && p.totalPages ? `Página ${p.page} de ${p.totalPages}` : 'Calculando páginas…';
  });

  /** "Quedan N páginas en este capítulo" (o el final del libro si no hay capítulos). */
  protected readonly chapterLeftLabel = computed(() => {
    let left: number | null = null;
    if (this.isPdf()) {
      const chapters = this.pdfChapters();
      const total = this.totalPages();
      if (!total) return '';
      const page = this.page();
      const next = chapters.find((c) => c.page > page);
      const end = next ? next.page - 1 : total; // última página del capítulo actual
      left = chapters.length ? end - page : total - page;
      if (!chapters.length) return left > 0 ? `Quedan ${left} páginas para terminar` : 'Última página';
    } else {
      const p = this.epubProgress();
      if (!p?.chapterTotal) return '';
      left = p.chapterTotal - (p.chapterPage ?? p.chapterTotal);
    }
    if (left <= 0) return 'Última página del capítulo';
    return left === 1 ? 'Queda 1 página en este capítulo' : `Quedan ${left} páginas en este capítulo`;
  });

  /** Guardado de progreso con debounce para no saturar la API. */
  private readonly progressUpdates = new Subject<SessionPatch>();
  private lastSaved: SessionPatch | null = null;
  /** Abierto desde la copia local sin API: no se sincroniza con el servidor. */
  private offlineMode = false;
  protected readonly initialEpubLocation = signal<string | null>(null);

  constructor() {
    this.progressUpdates
      .pipe(debounceTime(1500), distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)), takeUntilDestroyed())
      .subscribe((patch) => this.persist(patch));

    // Página actual del PDF → sesión de lectura (con debounce)
    effect(() => {
      const page = this.page();
      if (this.isPdf() && this.totalPages() > 0) {
        this.progressUpdates.next({ currentPage: page });
      }
    });

    // Solo en navegador: descarga y visores dependen del DOM
    afterNextRender(() => this.load());

    this.destroyRef.onDestroy(() => this.flush());
  }

  onKeydown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    if (target && ['INPUT', 'TEXTAREA'].includes(target.tagName)) return;
    if (event.key === 'Escape') {
      if (this.tocOpen()) {
        this.tocOpen.set(false);
      } else {
        void this.router.navigate(['/books', this.id()]);
      }
      return;
    }
    if (this.isPdf()) {
      if (event.key === 'ArrowRight' || event.key === 'PageDown') this.goToPage(this.page() + 1);
      if (event.key === 'ArrowLeft' || event.key === 'PageUp') this.goToPage(this.page() - 1);
    } else {
      if (event.key === 'ArrowRight') this.epub()?.next();
      if (event.key === 'ArrowLeft') this.epub()?.prev();
    }
  }

  // --- PDF ---

  goToPage(target: number): void {
    const total = this.totalPages();
    if (!total) return;
    const next = Math.min(Math.max(1, target), total);
    if (next !== this.page()) {
      this.page.set(next);
    }
  }

  onPageInput(event: Event): void {
    this.goToPage(Number((event.target as HTMLInputElement).value));
  }

  zoomBy(delta: number): void {
    this.zoom.set(Math.round(Math.min(3, Math.max(0.6, this.zoom() + delta)) * 10) / 10);
  }

  toggleMode(): void {
    this.mode.set(this.mode() === 'page' ? 'scroll' : 'page');
  }

  // --- EPUB ---

  fontBy(delta: number): void {
    this.fontSize.set(Math.min(200, Math.max(70, this.fontSize() + delta)));
  }

  onLocation(cfi: string): void {
    this.progressUpdates.next({ ebookLocation: cfi });
  }

  goToChapter(item: EpubTocItem): void {
    this.epub()?.goTo(item.href);
    this.tocOpen.set(false);
  }

  download(): void {
    const current = this.book();
    if (!current) return;
    this.downloading.set(true);
    const fallback = `${current.title}.${(current.ebookFormat ?? 'pdf').toLowerCase()}`;
    this.ebookService.download(current.id, fallback).subscribe({
      next: () => this.downloading.set(false),
      error: () => {
        this.downloading.set(false);
        this.toast.error('No se pudo descargar el archivo');
      }
    });
  }

  // --- carga y progreso ---

  private load(): void {
    const bookId = Number(this.id());
    this.bookService.get(bookId).subscribe({
      next: (book) => {
        this.book.set(book);
        this.seo.apply({ title: `Leyendo: ${book.title} — MyLibrary`, path: `/books/${book.id}/read` });
        if (!book.ebookFormat) {
          this.error.set('Este libro no tiene ningún archivo para leer');
          return;
        }
        this.restorePosition(book);
        void this.openFile(book);
      },
      // Sin conexión: si el libro está guardado en el dispositivo, se abre igualmente
      error: () => void this.openFromCacheOnly(bookId)
    });
  }

  /** Primero la copia local (offline); si no existe, el servidor. */
  private async openFile(book: Book): Promise<void> {
    const cached = await this.ebookCache.get(book.id).catch(() => null);
    if (cached && cached.format === book.ebookFormat) {
      this.data.set(await cached.blob.arrayBuffer());
      return;
    }
    this.progress.set(book.ebookSize ? `(${Math.round((book.ebookSize / 1024 / 1024) * 10) / 10} MB)` : '');
    this.ebookService.fetchBlob(book.id).subscribe({
      next: async (blob) => this.data.set(await blob.arrayBuffer()),
      error: () => this.error.set('No se pudo descargar el archivo del libro')
    });
  }

  private async openFromCacheOnly(bookId: number): Promise<void> {
    const cached = await this.ebookCache.get(bookId).catch(() => null);
    if (!cached) {
      this.error.set('No se pudo cargar el libro. Si estás sin conexión, solo puedes leer los guardados en el dispositivo');
      return;
    }
    this.offlineMode = true;
    const book: Book = {
      id: cached.bookId,
      title: cached.title,
      author: cached.author,
      ebookFormat: cached.format,
      ebookSize: cached.size,
      isbn: null, pages: null, categories: [], sagaId: null, sagaName: null, sagaOrder: null,
      type: 'DIGITAL', imageUrl: null, imagePath: null, description: null,
      createdAt: '', updatedAt: '', session: null
    };
    this.book.set(book);
    this.seo.apply({ title: `Leyendo: ${book.title} — MyLibrary`, path: `/books/${book.id}/read` });
    this.restorePosition(book);
    this.data.set(await cached.blob.arrayBuffer());
  }

  /** Posición de la sesión (servidor) o, si no hay, la última guardada en este dispositivo. */
  private restorePosition(book: Book): void {
    const local = this.readLocalPosition(book.id);
    if (book.ebookFormat === 'PDF') {
      const page = book.session?.currentPage ?? local?.page;
      if (page) this.page.set(page);
    } else {
      const cfi = book.session?.ebookLocation ?? local?.cfi ?? null;
      this.initialEpubLocation.set(cfi);
    }
  }

  private readLocalPosition(bookId: number): { page?: number; cfi?: string } | null {
    try {
      const raw = localStorage.getItem(`mylibrary-reader-pos-${bookId}`);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  private writeLocalPosition(bookId: number, position: { page?: number; cfi?: string }): void {
    try {
      localStorage.setItem(`mylibrary-reader-pos-${bookId}`, JSON.stringify(position));
    } catch {
      /* sin almacenamiento local: no pasa nada */
    }
  }

  private persist(patch: SessionPatch): void {
    const current = this.book();
    if (!current) return;
    this.lastSaved = patch;
    // Copia local siempre: permite reanudar aunque no haya conexión
    this.writeLocalPosition(current.id, { page: patch.currentPage ?? undefined, cfi: patch.ebookLocation ?? undefined });
    if (this.offlineMode) return;
    this.bookService.updateSession(current.id, patch).subscribe({
      error: () => {
        /* El progreso se reintenta en el siguiente cambio; no molestar al lector */
      }
    });
  }

  /** Último guardado al salir del lector (sin esperar al debounce). */
  private flush(): void {
    const current = this.book();
    if (!current || !this.isPdf()) return;
    const patch: SessionPatch = { currentPage: this.page() };
    if (JSON.stringify(patch) !== JSON.stringify(this.lastSaved)) {
      this.persist(patch);
    }
  }
}

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
import { SessionTimeoutService } from '../../core/services/session-timeout.service';
import { ThemeService } from '../../core/services/theme.service';
import { ToastService } from '../../core/services/toast.service';
import { IconComponent } from '../../shared/components/icon.component';
import { DictionaryPanelComponent, DictionaryRequest } from './dictionary-panel.component';
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
  imports: [RouterLink, IconComponent, PdfReaderComponent, EpubReaderComponent, DictionaryPanelComponent],
  host: {
    '(window:keydown)': 'onKeydown($event)'
  },
  template: `
    <!-- "Página sobre mesa": fondo suave, página con borde fino y controles sin recuadro -->
    <div class="fixed inset-0 z-40 flex flex-col bg-slate-50 text-slate-900 dark:bg-slate-900 dark:text-slate-100">
      <!-- Barra superior -->
      <header
        role="toolbar"
        aria-label="Controles del lector"
        class="flex flex-wrap items-center gap-1 border-b border-slate-200 bg-white px-2 py-1.5 dark:border-slate-800 dark:bg-slate-900 sm:gap-2 sm:px-4"
      >
        <a [routerLink]="['/books', id()]" class="icon-btn" aria-label="Volver al libro">
          <app-icon name="arrow-left" [size]="18" />
        </a>
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-semibold">{{ book()?.title ?? 'Cargando…' }}</p>
          @if (chapter()) {
            <p class="truncate text-xs text-slate-500 dark:text-slate-400">{{ chapter() }}</p>
          }
        </div>

        @if (book()?.ebookFormat === 'PDF') {
          <!-- En pantallas chicas no hay sitio para las flechas laterales: van aquí -->
          <div class="control-pill" aria-label="Navegación de páginas">
            <button type="button" class="icon-btn sm:!hidden" (click)="turnPage(-1)" [disabled]="!canTurnPage(-1)" aria-label="Página anterior">
              <app-icon name="chevron-left" [size]="16" />
            </button>
            <label class="sr-only" for="page-input">Página actual</label>
            <input
              id="page-input"
              type="number"
              class="h-8 w-14 rounded-md border-0 bg-transparent p-0 text-center text-sm tabular-nums focus:bg-white focus:ring-1 focus:ring-primary-500 dark:focus:bg-slate-900"
              [value]="page()"
              min="1"
              [max]="totalPages()"
              (change)="onPageInput($event)"
            />
            <span class="pr-2 text-xs tabular-nums text-slate-500 dark:text-slate-400" aria-live="polite">/ {{ totalPages() || '…' }}</span>
            <button type="button" class="icon-btn sm:!hidden" (click)="turnPage(1)" [disabled]="!canTurnPage(1)" aria-label="Página siguiente">
              <app-icon name="chevron-right" [size]="16" />
            </button>
          </div>
          <div class="control-pill !hidden sm:!flex" aria-label="Zoom">
            <button type="button" class="icon-btn" (click)="zoomBy(-0.2)" [disabled]="zoom() <= 0.6" aria-label="Reducir">
              <app-icon name="minus" [size]="16" />
            </button>
            <button type="button" class="icon-btn" (click)="zoom.set(1)" aria-label="Ajustar al ancho">
              <app-icon name="arrows-expand" [size]="16" />
            </button>
            <button type="button" class="icon-btn" (click)="zoomBy(0.2)" [disabled]="zoom() >= 3" aria-label="Ampliar">
              <app-icon name="plus" [size]="16" />
            </button>
          </div>
          <button
            type="button"
            class="icon-btn"
            (click)="toggleMode()"
            [attr.aria-pressed]="mode() === 'scroll'"
            [attr.aria-label]="mode() === 'scroll' ? 'Cambiar a modo página' : 'Cambiar a desplazamiento continuo'"
          >
            <app-icon [name]="mode() === 'scroll' ? 'view-columns' : 'bars-arrow-down'" [size]="16" />
          </button>
        }

        @if (book()?.ebookFormat === 'EPUB') {
          <!-- En pantallas chicas no hay sitio para las flechas laterales: van aquí -->
          <div class="flex items-center sm:hidden" aria-label="Navegación">
            <button type="button" class="icon-btn" (click)="turnPage(-1)" aria-label="Página anterior">
              <app-icon name="chevron-left" [size]="16" />
            </button>
            <button type="button" class="icon-btn" (click)="turnPage(1)" aria-label="Página siguiente">
              <app-icon name="chevron-right" [size]="16" />
            </button>
          </div>
          <div class="control-pill !hidden sm:!flex" aria-label="Tamaño de letra">
            <button type="button" class="icon-btn" (click)="fontBy(-10)" [disabled]="fontSize() <= 70" aria-label="Letra más pequeña">
              <app-icon name="minus" [size]="16" />
            </button>
            <span class="w-11 text-center text-xs tabular-nums text-slate-600 dark:text-slate-300">{{ fontSize() }} %</span>
            <button type="button" class="icon-btn" (click)="fontBy(10)" [disabled]="fontSize() >= 200" aria-label="Letra más grande">
              <app-icon name="plus" [size]="16" />
            </button>
          </div>
          <button
            type="button"
            class="icon-btn"
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
          [class]="dictOpen() ? 'icon-btn bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300' : 'icon-btn'"
          (click)="toggleDictionary()"
          [attr.aria-pressed]="dictOpen()"
          aria-controls="reader-dictionary"
          aria-label="Diccionario"
          title="Diccionario"
        >
          <app-icon name="book-open" [size]="16" />
        </button>
        <button
          type="button"
          class="icon-btn"
          (click)="theme.toggle()"
          [attr.aria-label]="theme.darkMode() ? 'Activar modo claro' : 'Activar modo oscuro'"
        >
          <app-icon [name]="theme.darkMode() ? 'sun' : 'moon'" [size]="16" />
        </button>
        <button type="button" class="icon-btn" (click)="download()" [disabled]="downloading()" aria-label="Descargar archivo">
          <app-icon name="download" [size]="16" />
        </button>
      </header>

      <!-- Área de lectura: el libro y, si está abierto, el diccionario a la derecha -->
      <div class="flex min-h-0 flex-1">
      <div class="relative min-h-0 min-w-0 flex-1">
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
        } @else {
          <!-- Página vertical centrada (nunca a todo el ancho) con una flecha a cada lado -->
          <div class="mx-auto flex h-full w-full max-w-[54rem] items-stretch justify-center sm:gap-3 sm:px-4 sm:pb-1 sm:pt-4">
            <button
              type="button"
              class="page-arrow hidden sm:flex"
              (click)="turnPage(-1)"
              [disabled]="!canTurnPage(-1)"
              aria-label="Página anterior"
            >
              <app-icon name="chevron-left" [size]="18" />
            </button>

            <div
              class="flex min-w-0 max-w-[46rem] flex-1 flex-col overflow-hidden bg-white dark:bg-[#1d2318]
                     sm:rounded-xl sm:border sm:border-slate-200 sm:shadow-sm dark:sm:border-slate-800"
            >
              <div class="min-h-0 flex-1">
                @if (book()?.ebookFormat === 'PDF') {
                  <app-pdf-reader
                    [data]="data()!"
                    [mode]="mode()"
                    [zoom]="zoom()"
                    [(page)]="page"
                    (totalPages)="totalPages.set($event)"
                    (outlineLoaded)="pdfChapters.set($event)"
                  />
                } @else if (book()?.ebookFormat === 'EPUB') {
                  <app-epub-reader
                    #epubReader
                    [data]="data()!"
                    [initialLocation]="initialEpubLocation()"
                    [dark]="theme.darkMode()"
                    [fontSize]="fontSize()"
                    (wordSelected)="lookupWord($event)"
                    (locationChange)="onLocation($event)"
                    (chapterChange)="chapter.set($event)"
                    (tocLoaded)="toc.set($event)"
                    (progressChange)="epubProgress.set($event)"
                    [cacheKey]="id()"
                  />
                }
              </div>
              <!-- Número de página al pie de la hoja, como en un libro -->
              <p class="h-8 shrink-0 text-center text-xs tabular-nums leading-8 text-slate-400 dark:text-slate-500" aria-live="polite">
                {{ pageLabel() }}
              </p>
            </div>

            <button
              type="button"
              class="page-arrow hidden sm:flex"
              (click)="turnPage(1)"
              [disabled]="!canTurnPage(1)"
              aria-label="Página siguiente"
            >
              <app-icon name="chevron-right" [size]="18" />
            </button>
          </div>

          <!-- Índice EPUB -->
          @if (tocOpen()) {
            <nav
              id="reader-toc"
              aria-label="Índice del libro"
              class="absolute inset-y-0 left-0 z-10 w-72 max-w-[85vw] overflow-y-auto border-r border-slate-200 bg-white p-3 shadow-lg dark:border-slate-800 dark:bg-slate-900"
            >
              <div class="mb-2 flex items-center justify-between pl-2">
                <p class="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Índice</p>
                <button type="button" class="icon-btn !h-8 !w-8" (click)="tocOpen.set(false)" aria-label="Cerrar índice">
                  <app-icon name="x-mark" [size]="14" />
                </button>
              </div>
              @if (toc().length === 0) {
                <p class="px-2 text-xs text-slate-500 dark:text-slate-400">Este libro no incluye índice.</p>
              }
              <ul class="space-y-0.5" role="list">
                @for (item of toc(); track $index) {
                  <li>
                    <button
                      type="button"
                      [class]="tocItemClass(item)"
                      [attr.aria-current]="item.label === chapter() ? 'true' : null"
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

      @if (dictOpen() && data() && !error()) {
        <!-- Desde lg el libro cede ancho al panel; en pantallas chicas el panel se superpone -->
        <app-dictionary-panel
          id="reader-dictionary"
          class="absolute inset-y-0 right-0 z-20 w-80 max-w-[90vw] shadow-lg lg:static lg:z-auto lg:w-[22rem] lg:max-w-none lg:shrink-0 lg:shadow-none"
          [request]="dictRequest()"
          [canSelect]="book()?.ebookFormat === 'EPUB'"
          (closed)="closeDictionary()"
        />
      }
      </div>

      <!-- Pie de progreso: lo que queda del capítulo, barra y porcentaje en una sola línea -->
      @if (data() && !error()) {
        <footer class="px-4 py-2 text-xs text-slate-500 dark:text-slate-400" aria-live="polite">
          <div class="mx-auto flex w-full max-w-[46rem] items-center gap-3">
            <span class="min-w-0 truncate">{{ chapterLeftLabel() }}</span>
            <div class="h-1 min-w-10 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700" aria-hidden="true">
              <div class="h-full rounded-full bg-primary-500 transition-[width] duration-300" [style.width.%]="progressPercent() ?? 0"></div>
            </div>
            <span class="w-10 shrink-0 text-right tabular-nums">{{ progressPercent() !== null ? progressPercent() + ' %' : '' }}</span>
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
  private readonly sessionTimeout = inject(SessionTimeoutService);
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
      if (this.dictOpen()) {
        this.closeDictionary();
      } else if (this.tocOpen()) {
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

  // --- diccionario ---

  protected readonly dictOpen = signal(false);
  protected readonly dictRequest = signal<DictionaryRequest | null>(null);
  private dictSeq = 0;

  /** Palabra seleccionada en el libro: abre el panel y la busca. */
  protected lookupWord(word: string): void {
    this.dictRequest.set({ word, id: ++this.dictSeq });
    this.dictOpen.set(true);
  }

  protected toggleDictionary(): void {
    if (this.dictOpen()) {
      this.closeDictionary();
    } else {
      this.dictOpen.set(true);
    }
  }

  protected closeDictionary(): void {
    this.dictOpen.set(false);
    // Sin esto, al reabrirlo a mano volvería a buscar la última palabra
    this.dictRequest.set(null);
  }

  /** Pasa página hacia atrás (−1) o hacia delante (+1) en cualquiera de los dos formatos. */
  protected turnPage(direction: 1 | -1): void {
    if (this.isPdf()) {
      this.goToPage(this.page() + direction);
    } else if (direction > 0) {
      this.epub()?.next();
    } else {
      this.epub()?.prev();
    }
  }

  /** En PDF se conocen los extremos; en EPUB es el propio libro quien se detiene. */
  protected canTurnPage(direction: 1 | -1): boolean {
    if (!this.isPdf()) return true;
    return direction > 0 ? this.page() < this.totalPages() : this.page() > 1;
  }

  /** Entrada del índice; la del capítulo abierto queda resaltada. */
  protected tocItemClass(item: EpubTocItem): string {
    const base = 'w-full rounded-lg px-2 py-1.5 text-left text-sm transition-colors ';
    return item.label === this.chapter()
      ? base + 'bg-primary-50 font-semibold text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
      : base + 'hover:bg-slate-100 dark:hover:bg-slate-800';
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
    // Pasar página dentro del iframe del libro también es usar la app
    this.sessionTimeout.markActivity();
    this.progressUpdates.next({ ebookLocation: cfi });
  }

  goToChapter(item: EpubTocItem): void {
    this.tocOpen.set(false);
    void this.epub()?.goTo(item.href).then((opened) => {
      if (!opened) this.toast.error('No se pudo abrir ese capítulo');
    });
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

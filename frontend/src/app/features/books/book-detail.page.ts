import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Book, ReadingStatus } from '../../core/models';
import { BookService } from '../../core/services/book.service';
import { EbookService } from '../../core/services/ebook.service';
import { EbookCacheService } from '../../core/services/ebook-cache.service';
import { SeoService } from '../../core/services/seo.service';
import { ToastService } from '../../core/services/toast.service';
import { formatBytes } from '../../core/utils/file-download';
import { EbookUploaderComponent } from '../../shared/components/ebook-uploader.component';
import { BookTypeLabelPipe } from '../../shared/pipes/book-type-label.pipe';
import { ReadingStatusLabelPipe } from '../../shared/pipes/reading-status-label.pipe';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog.component';
import { StarRatingComponent } from '../../shared/components/star-rating.component';
import { IconComponent } from '../../shared/components/icon.component';

type TabId = 'session' | 'notes' | 'info';

const TABS: { value: TabId; label: string; icon: string }[] = [
  { value: 'session', label: 'Sesión',  icon: 'calendar' },
  { value: 'notes',   label: 'Notas',   icon: 'pencil' },
  { value: 'info',    label: 'Info',    icon: 'tag' },
];

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
  selector: 'app-book-detail-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    FormsModule,
    RouterLink,
    BookTypeLabelPipe,
    ReadingStatusLabelPipe,
    ConfirmDialogComponent,
    StarRatingComponent,
    IconComponent,
    EbookUploaderComponent
  ],
  template: `
    @if (book(); as b) {
      <article aria-labelledby="book-title" itemscope itemtype="https://schema.org/Book">

        <!-- ── Breadcrumb + action buttons ── -->
        <div class="mb-5 flex flex-wrap items-center justify-between gap-3">
          <nav aria-label="Miga de pan" class="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
            <a routerLink="/books"
               class="flex items-center gap-1 transition-colors hover:text-primary-600 dark:hover:text-primary-400">
              <app-icon name="book-open" [size]="14" /> Mis libros
            </a>
            <app-icon name="chevron-right" [size]="14" aria-hidden="true" />
            <span aria-current="page" class="line-clamp-1 max-w-[200px] text-slate-700 dark:text-slate-200">
              {{ b.title }}
            </span>
          </nav>
          <div class="flex shrink-0 gap-2">
            <a [routerLink]="['/books', b.id, 'edit']" class="btn-secondary">
              <app-icon name="pencil" [size]="15" /> Editar
            </a>
            <button type="button" class="btn-danger" (click)="deleting.set(true)">
              <app-icon name="trash" [size]="15" /> Eliminar
            </button>
          </div>
        </div>

        <!-- ── Hero card ── -->
        <div class="card mb-6 overflow-hidden">
          <div class="flex gap-0">

            <!-- Cover -->
            <div class="w-28 shrink-0 sm:w-40 lg:w-48">
              @if (cover(); as url) {
                <img
                  [src]="url"
                  [alt]="'Portada de ' + b.title + ' de ' + b.author"
                  loading="lazy"
                  itemprop="image"
                  class="h-full w-full object-cover"
                />
              } @else {
                <div
                  class="flex h-full min-h-[180px] items-center justify-center"
                  [style.background]="gradient()"
                  aria-hidden="true"
                >
                  <span class="select-none text-6xl font-bold text-white/30">
                    {{ b.title.charAt(0).toUpperCase() }}
                  </span>
                </div>
              }
            </div>

            <!-- Info panel -->
            <div class="flex min-w-0 flex-1 flex-col gap-3 p-4 sm:p-6">

              <!-- Title + author -->
              <div>
                <h1
                  id="book-title"
                  class="font-serif text-xl font-bold leading-snug sm:text-2xl lg:text-3xl"
                  itemprop="name"
                >{{ b.title }}</h1>
                <p class="mt-0.5 text-base text-slate-500 dark:text-slate-400" itemprop="author">
                  {{ b.author }}
                </p>
              </div>

              <!-- Badges row -->
              <div class="flex flex-wrap gap-1.5">
                <span
                  class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold"
                  [class.bg-slate-200]="statusValue() === 'PENDING'"
                  [class.text-slate-700]="statusValue() === 'PENDING'"
                  [class.bg-toffee-brown]="statusValue() === 'READING'"
                  [class.text-amber-100]="statusValue() === 'READING'"
                  [class.bg-dusty-olive]="statusValue() === 'FINISHED'"
                  [class.text-green-100]="statusValue() === 'FINISHED'"
                >
                  <span class="h-1.5 w-1.5 rounded-full bg-current opacity-70"></span>
                  {{ statusValue() | readingStatusLabel }}
                </span>
                <span
                  class="inline-flex items-center rounded-full border border-slate-200 px-2.5 py-0.5
                         text-xs text-slate-600 dark:border-slate-700 dark:text-slate-300"
                >{{ b.type | bookTypeLabel }}</span>
                @if (b.ebookFormat) {
                  <span
                    class="inline-flex items-center gap-1 rounded-full border border-primary-200
                           bg-primary-50 px-2.5 py-0.5 text-xs font-medium text-primary-700
                           dark:border-primary-700/50 dark:bg-primary-900/20 dark:text-primary-300"
                  >
                    <app-icon name="document-text" [size]="11" /> {{ b.ebookFormat }}
                  </span>
                }
                @if (b.sagaName) {
                  <span
                    class="inline-flex items-center rounded-full border border-slate-200 px-2.5 py-0.5
                           text-xs text-slate-600 dark:border-slate-700 dark:text-slate-300"
                  >{{ b.sagaName }}@if (b.sagaOrder) {&nbsp;#{{ b.sagaOrder }}}</span>
                }
              </div>

              <!-- Reading progress (READING) -->
              @if (statusValue() === 'READING' && progressPct() !== null) {
                <div>
                  <div class="mb-1 flex items-center justify-between text-xs text-slate-500">
                    <span>Pág. {{ b.session!.currentPage }} / {{ b.pages }}</span>
                    <span class="font-semibold text-toffee-brown">{{ progressPct() }}%</span>
                  </div>
                  <div class="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                    <div
                      class="h-full rounded-full bg-toffee-brown transition-all"
                      [style.width.%]="progressPct()"
                    ></div>
                  </div>
                </div>
              }

              <!-- Rating display (FINISHED) -->
              @if (statusValue() === 'FINISHED' && b.session?.rating) {
                <app-star-rating [rating]="b.session!.rating!" [readonly]="true" />
              }

              <!-- Description (truncated, desktop only) -->
              @if (b.description) {
                <p
                  class="hidden line-clamp-2 text-sm text-slate-600 dark:text-slate-300 sm:block"
                  itemprop="description"
                >{{ b.description }}</p>
              }

              <!-- CTA buttons -->
              <div class="mt-auto flex flex-wrap gap-2 pt-1">
                @if (b.ebookFormat) {
                  <a [routerLink]="['/books', b.id, 'read']" class="btn-primary">
                    <app-icon name="book-open" [size]="16" />
                    {{ statusValue() === 'READING' ? 'Continuar leyendo' : 'Leer' }}
                  </a>
                  <button
                    type="button"
                    class="btn-secondary"
                    (click)="downloadEbook()"
                    [disabled]="downloading()"
                  >
                    <app-icon name="download" [size]="16" />
                    {{ downloading() ? 'Descargando…' : 'Descargar' }}
                  </button>
                }
              </div>
            </div>
          </div>
        </div>

        <!-- ── Tab navigation ── -->
        <div
          class="mb-4 flex gap-0.5 rounded-xl border border-slate-200 bg-slate-100/80 p-1
                 dark:border-slate-700 dark:bg-slate-800/50"
          role="tablist"
          aria-label="Secciones del libro"
        >
          @for (tab of tabs; track tab.value) {
            <button
              type="button"
              role="tab"
              [class]="activeTab() === tab.value
                ? 'flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors bg-white shadow-sm text-slate-900 dark:bg-slate-900 dark:text-slate-100'
                : 'flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors text-slate-500 hover:text-slate-700 dark:text-slate-400'"
              [attr.aria-selected]="activeTab() === tab.value"
              (click)="activeTab.set(tab.value)"
            >
              <app-icon [name]="tab.icon" [size]="15" />
              {{ tab.label }}
            </button>
          }
        </div>

        <!-- ── Session tab ── -->
        @if (activeTab() === 'session') {
          <div class="card p-5 sm:p-6" role="tabpanel" aria-label="Sesión de lectura">
            @if (b.session; as session) {
              <div class="space-y-5">

                <!-- Status buttons -->
                <div>
                  <p class="label mb-2">Estado de lectura</p>
                  <div class="flex flex-wrap gap-2" role="group" aria-label="Cambiar estado de lectura">
                    @for (status of statuses; track status) {
                      <button
                        type="button"
                        class="btn"
                        [class.bg-primary-600]="session.status === status"
                        [class.text-white]="session.status === status"
                        [class.btn-secondary]="session.status !== status"
                        [attr.aria-pressed]="session.status === status"
                        (click)="changeStatus(status)"
                      >{{ status | readingStatusLabel }}</button>
                    }
                  </div>
                </div>

                <!-- Dates + current page -->
                <div class="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3" aria-live="polite">
                  @if (session.startDate) {
                    <div class="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
                      <p class="text-xs text-slate-400">Inicio</p>
                      <p class="mt-0.5 font-semibold">{{ session.startDate | date:'dd MMM yyyy' }}</p>
                    </div>
                  }
                  @if (session.endDate) {
                    <div class="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
                      <p class="text-xs text-slate-400">Finalización</p>
                      <p class="mt-0.5 font-semibold">{{ session.endDate | date:'dd MMM yyyy' }}</p>
                    </div>
                  }
                  @if (session.status === 'READING' && b.pages) {
                    <div>
                      <label class="label" for="current-page">Página actual</label>
                      <input
                        id="current-page"
                        type="number"
                        class="input"
                        min="0"
                        [max]="b.pages"
                        [ngModel]="session.currentPage"
                        (change)="updateCurrentPage($event)"
                      />
                    </div>
                  }
                </div>

                <!-- Rating (FINISHED) -->
                @if (session.status === 'FINISHED') {
                  <div>
                    <p class="label">Tu valoración</p>
                    <app-star-rating [rating]="session.rating ?? 0" (ratingChange)="updateRating($event)" />
                  </div>
                }
              </div>
            }
          </div>
        }

        <!-- ── Notes tab ── -->
        @if (activeTab() === 'notes') {
          <div class="card p-5 sm:p-6" role="tabpanel" aria-label="Notas">
            @if (b.session; as session) {
              <label class="label" for="notes">Tus notas</label>
              <textarea
                id="notes"
                rows="8"
                class="input"
                placeholder="Tus impresiones, citas favoritas, personajes que te gustaron…"
                [ngModel]="session.notes"
                (change)="updateNotes($event)"
              ></textarea>
            }
          </div>
        }

        <!-- ── Info tab ── -->
        @if (activeTab() === 'info') {
          <div class="space-y-4" role="tabpanel" aria-label="Información del libro">

            <!-- Metadata card -->
            <div class="card p-5 sm:p-6">
              <h2 class="cat-section-label mb-4">Detalles</h2>
              <dl class="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
                <div>
                  <dt class="text-xs text-slate-400">Tipo</dt>
                  <dd class="mt-0.5 font-medium">{{ b.type | bookTypeLabel }}</dd>
                </div>
                @if (b.isbn) {
                  <div>
                    <dt class="text-xs text-slate-400">ISBN</dt>
                    <dd class="mt-0.5 font-medium" itemprop="isbn">{{ b.isbn }}</dd>
                  </div>
                }
                @if (b.pages) {
                  <div>
                    <dt class="text-xs text-slate-400">Páginas</dt>
                    <dd class="mt-0.5 font-medium" itemprop="numberOfPages">{{ b.pages }}</dd>
                  </div>
                }
                @if (b.sagaName) {
                  <div>
                    <dt class="text-xs text-slate-400">Saga</dt>
                    <dd class="mt-0.5 font-medium">
                      {{ b.sagaName }}@if (b.sagaOrder) {&nbsp;(#{{ b.sagaOrder }})}
                    </dd>
                  </div>
                }
              </dl>

              @if (b.categories.length) {
                <div class="mt-4">
                  <p class="mb-2 text-xs text-slate-400">Categorías</p>
                  <div class="flex flex-wrap gap-1.5">
                    @for (category of b.categories; track category.id) {
                      <span
                        class="rounded-full bg-primary-100 px-2.5 py-0.5 text-xs font-medium text-primary-700
                               dark:bg-primary-900/50 dark:text-primary-300"
                        itemprop="genre"
                      >{{ category.name }}</span>
                    }
                  </div>
                </div>
              }

              @if (b.description) {
                <div class="mt-4">
                  <p class="mb-1 text-xs text-slate-400">Descripción</p>
                  <p class="text-sm text-slate-600 dark:text-slate-300" itemprop="description">
                    {{ b.description }}
                  </p>
                </div>
              }
            </div>

            <!-- Ebook management card -->
            <div class="card p-5 sm:p-6">
              <h2 class="cat-section-label mb-3 flex items-center gap-1.5">
                <app-icon name="document-text" [size]="12" /> Archivo del libro
              </h2>
              @if (b.ebookFormat) {
                <p class="mb-3 text-sm text-slate-500 dark:text-slate-400">
                  {{ b.ebookFormat }} · {{ formatBytes(b.ebookSize) }}
                </p>
                <div class="flex flex-wrap gap-2">
                  @if (ebookCache.available) {
                    @if (availableOffline()) {
                      <span
                        class="inline-flex items-center gap-1 rounded-full bg-dry-sage px-3 py-1.5
                               text-sm font-medium text-charcoal-brown
                               dark:bg-dusty-olive/60 dark:text-dry-sage"
                        role="status"
                      >
                        <app-icon name="download" [size]="14" /> Disponible sin conexión
                      </span>
                      <button type="button" class="btn-secondary" (click)="removeOffline()">
                        Quitar del dispositivo
                      </button>
                    } @else {
                      <button
                        type="button"
                        class="btn-primary"
                        (click)="saveOffline()"
                        [disabled]="savingOffline()"
                      >
                        <app-icon name="download" [size]="16" />
                        {{ savingOffline() ? 'Guardando…' : 'Guardar para leer sin conexión' }}
                      </button>
                    }
                  }
                  <button
                    type="button"
                    class="btn-secondary"
                    (click)="replacingEbook.set(!replacingEbook())"
                    [attr.aria-expanded]="replacingEbook()"
                  >
                    {{ replacingEbook() ? 'Cancelar' : 'Sustituir archivo' }}
                  </button>
                  <button
                    type="button"
                    class="btn-secondary text-red-600 dark:text-red-400"
                    (click)="removingEbook.set(true)"
                  >
                    Quitar archivo
                  </button>
                </div>
                @if (replacingEbook()) {
                  <div class="mt-3">
                    <app-ebook-uploader
                      [uploadFn]="attachFn"
                      buttonLabel="Elegir nuevo archivo"
                      (uploaded)="onEbookUploaded($event)"
                    />
                  </div>
                }
              } @else {
                <p class="mb-3 text-sm text-slate-500 dark:text-slate-400">
                  Adjunta el PDF o EPUB para leerlo desde la aplicación y descargarlo cuando quieras.
                </p>
                <app-ebook-uploader [uploadFn]="attachFn" (uploaded)="onEbookUploaded($event)" />
              }
            </div>

            <!-- Saga siblings card -->
            @if (sagaSiblings().length) {
              <div class="card p-5 sm:p-6">
                <h2 class="cat-section-label mb-3">Más de «{{ b.sagaName }}»</h2>
                <ul class="space-y-1" role="list">
                  @for (sibling of sagaSiblings(); track sibling.id) {
                    <li>
                      <a
                        [routerLink]="['/books', sibling.id]"
                        class="flex items-center gap-2 rounded-lg p-2 text-sm text-primary-600
                               transition-colors hover:bg-primary-50 hover:underline
                               dark:text-primary-400 dark:hover:bg-primary-900/10"
                      >
                        @if (sibling.sagaOrder) {
                          <span
                            class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full
                                   bg-primary-100 text-xs font-semibold text-primary-700
                                   dark:bg-primary-900/50 dark:text-primary-300"
                          >{{ sibling.sagaOrder }}</span>
                        }
                        {{ sibling.title }}
                      </a>
                    </li>
                  }
                </ul>
              </div>
            }

          </div>
        }

      </article>

    } @else {
      <!-- Skeleton loading -->
      <div class="animate-pulse space-y-5">
        <div class="h-5 w-48 rounded bg-slate-200 dark:bg-slate-700"></div>
        <div class="card overflow-hidden">
          <div class="flex">
            <div class="w-40 bg-slate-200 dark:bg-slate-700" style="aspect-ratio:2/3"></div>
            <div class="flex flex-1 flex-col gap-3 p-6">
              <div class="h-7 w-3/4 rounded bg-slate-200 dark:bg-slate-700"></div>
              <div class="h-5 w-1/2 rounded bg-slate-100 dark:bg-slate-800"></div>
              <div class="h-4 w-1/3 rounded bg-slate-100 dark:bg-slate-800"></div>
            </div>
          </div>
        </div>
      </div>
    }

    <app-confirm-dialog
      [open]="deleting()"
      title="Eliminar libro"
      message="¿Seguro que quieres eliminar este libro? Esta acción no se puede deshacer."
      (confirmed)="confirmDelete()"
      (cancelled)="deleting.set(false)"
    />

    <app-confirm-dialog
      [open]="removingEbook()"
      title="Quitar archivo"
      message="Se eliminará el PDF/EPUB de este libro. El libro y su sesión de lectura se conservan."
      confirmLabel="Quitar"
      (confirmed)="confirmRemoveEbook()"
      (cancelled)="removingEbook.set(false)"
    />
  `
})
export class BookDetailPage {
  private readonly bookService = inject(BookService);
  private readonly ebookService = inject(EbookService);
  protected readonly ebookCache = inject(EbookCacheService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly seo = inject(SeoService);

  readonly id = input.required<string>();

  protected readonly statuses: ReadingStatus[] = ['PENDING', 'READING', 'FINISHED'];
  protected readonly tabs = TABS;

  protected readonly book = signal<Book | null>(null);
  protected readonly sagaSiblings = signal<Book[]>([]);
  protected readonly activeTab = signal<TabId>('session');
  protected readonly deleting = signal(false);
  protected readonly replacingEbook = signal(false);
  protected readonly removingEbook = signal(false);
  protected readonly downloading = signal(false);
  protected readonly savingOffline = signal(false);

  protected readonly availableOffline = computed(() => {
    const b = this.book();
    return !!b && this.ebookCache.cachedIds().has(b.id);
  });
  protected readonly formatBytes = formatBytes;
  protected readonly cover = computed(() => {
    const b = this.book();
    return b ? this.bookService.coverUrl(b) : null;
  });
  protected readonly statusValue = computed(() => this.book()?.session?.status ?? 'PENDING');
  protected readonly progressPct = computed((): number | null => {
    const b = this.book();
    const cur = b?.session?.currentPage;
    const total = b?.pages;
    if (!cur || !total || total <= 0) return null;
    return Math.min(100, Math.round((cur / total) * 100));
  });
  protected readonly gradient = computed((): string => {
    const title = this.book()?.title ?? '';
    let hash = 0;
    for (const ch of title) hash = (hash + ch.charCodeAt(0)) % COVER_GRADIENTS.length;
    const [from, to] = COVER_GRADIENTS[hash];
    return `linear-gradient(145deg,${from},${to})`;
  });

  /** Sube el archivo al libro actual (lo usa el uploader). */
  protected readonly attachFn = (file: File) => this.ebookService.attach(Number(this.id()), file);

  constructor() {
    // La ruta /books/:id reutiliza este componente al navegar entre libros
    // (p. ej. entre los de una saga): recargar cada vez que cambia el id.
    effect(() => {
      this.id();
      this.book.set(null);
      this.sagaSiblings.set([]);
      this.activeTab.set('session');
      this.deleting.set(false);
      this.replacingEbook.set(false);
      this.removingEbook.set(false);
      this.load();
    });
  }

  onEbookUploaded(book: Book): void {
    this.book.set(book);
    this.replacingEbook.set(false);
    this.toast.success('Archivo adjuntado al libro');
  }

  downloadEbook(): void {
    const current = this.book();
    if (!current || this.downloading()) {
      return;
    }
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

  saveOffline(): void {
    const current = this.book();
    if (!current || !current.ebookFormat) {
      return;
    }
    this.savingOffline.set(true);
    this.ebookService.fetchBlob(current.id).subscribe({
      next: async (blob) => {
        try {
          await this.ebookCache.save({
            bookId: current.id,
            title: current.title,
            author: current.author,
            format: current.ebookFormat!,
            size: blob.size,
            savedAt: Date.now(),
            blob
          });
          this.toast.success('Libro guardado: ya puedes leerlo sin conexión');
        } catch {
          this.toast.error('No se pudo guardar en el dispositivo (¿espacio insuficiente?)');
        } finally {
          this.savingOffline.set(false);
        }
      },
      error: () => {
        this.savingOffline.set(false);
        this.toast.error('No se pudo descargar el archivo');
      }
    });
  }

  removeOffline(): void {
    const current = this.book();
    if (!current) {
      return;
    }
    void this.ebookCache.remove(current.id).then(() => this.toast.info('Libro quitado del dispositivo'));
  }

  confirmRemoveEbook(): void {
    const current = this.book();
    if (!current) {
      return;
    }
    this.ebookService.remove(current.id).subscribe({
      next: (book) => {
        this.removingEbook.set(false);
        this.book.set(book);
        this.toast.success('Archivo eliminado');
      },
      error: () => {
        this.removingEbook.set(false);
        this.toast.error('No se pudo quitar el archivo');
      }
    });
  }

  changeStatus(status: ReadingStatus): void {
    const current = this.book();
    if (!current || current.session?.status === status) {
      return;
    }
    this.bookService.updateSession(current.id, { status }).subscribe({
      next: (session) => {
        this.book.update((b) => (b ? { ...b, session } : b));
        this.toast.success('Estado actualizado');
      },
      error: () => this.toast.error('No se pudo actualizar el estado')
    });
  }

  updateRating(rating: number): void {
    this.patchSession({ rating: rating || null });
  }

  updateCurrentPage(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.patchSession({ currentPage: Number.isFinite(value) ? value : null });
  }

  updateNotes(event: Event): void {
    this.patchSession({ notes: (event.target as HTMLTextAreaElement).value });
  }

  confirmDelete(): void {
    const current = this.book();
    if (!current) {
      return;
    }
    this.bookService.delete(current.id).subscribe({
      next: () => {
        this.toast.success('Libro eliminado');
        void this.router.navigate(['/books']);
      },
      error: () => {
        this.deleting.set(false);
        this.toast.error('No se pudo eliminar el libro');
      }
    });
  }

  private patchSession(patch: Parameters<BookService['updateSession']>[1]): void {
    const current = this.book();
    if (!current) {
      return;
    }
    this.bookService.updateSession(current.id, patch).subscribe({
      next: (session) => this.book.update((b) => (b ? { ...b, session } : b)),
      error: () => this.toast.error('No se pudo guardar el cambio')
    });
  }

  private load(): void {
    this.bookService.get(Number(this.id())).subscribe({
      next: (book) => {
        this.book.set(book);
        this.applySeo(book);
        this.loadSagaSiblings(book);
      },
      error: () => {
        this.toast.error('Libro no encontrado');
        void this.router.navigate(['/books']);
      }
    });
  }

  private loadSagaSiblings(book: Book): void {
    if (!book.sagaId) {
      this.sagaSiblings.set([]);
      return;
    }
    this.bookService.list({ saga: String(book.sagaId), size: 50 }).subscribe((page) => {
      const siblings = page.content
        .filter((b) => b.id !== book.id)
        .sort((a, b2) => (a.sagaOrder ?? 99) - (b2.sagaOrder ?? 99));
      this.sagaSiblings.set(siblings);
    });
  }

  private applySeo(book: Book): void {
    const cover = this.bookService.coverUrl(book);
    this.seo.apply({
      title: `${book.title} — MyLibrary`,
      description: book.description ?? `${book.title}, de ${book.author}, en tu biblioteca personal.`,
      ogImage: cover,
      path: `/books/${book.id}`
    });
    this.seo.setJsonLd({
      '@context': 'https://schema.org',
      '@type': 'Book',
      name: book.title,
      author: { '@type': 'Person', name: book.author },
      ...(book.isbn ? { isbn: book.isbn } : {}),
      ...(book.pages ? { numberOfPages: book.pages } : {}),
      ...(cover ? { image: cover } : {}),
      ...(book.categories.length ? { genre: book.categories.map((c) => c.name) } : {}),
      ...(book.sagaName
        ? {
            isPartOf: { '@type': 'BookSeries', name: book.sagaName },
            ...(book.sagaOrder ? { position: book.sagaOrder } : {})
          }
        : {})
    });
  }
}

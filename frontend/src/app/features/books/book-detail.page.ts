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
        <nav aria-label="Miga de pan" class="text-sm text-slate-500">
          <a routerLink="/books" class="hover:underline">Mis libros</a>
          <span aria-hidden="true"> / </span>
          <span aria-current="page">{{ b.title }}</span>
        </nav>

        <div class="mt-4 grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div>
            <div class="card overflow-hidden">
              @if (cover(); as url) {
                <img
                  [src]="url"
                  [alt]="'Portada de ' + b.title + ' de ' + b.author"
                  loading="lazy"
                  itemprop="image"
                  class="aspect-[2/3] w-full object-cover"
                />
              } @else {
                <div class="flex aspect-[2/3] items-center justify-center bg-slate-100 text-slate-300 dark:bg-slate-800 dark:text-slate-600" aria-hidden="true">
                  <app-icon name="book-open" [size]="72" [strokeWidth]="1" />
                </div>
              }
            </div>
            @if (b.ebookFormat) {
              <div class="mt-4 flex gap-2">
                <a [routerLink]="['/books', b.id, 'read']" class="btn-primary flex-1">
                  <app-icon name="book-open" [size]="18" /> Leer
                </a>
                <button
                  type="button"
                  class="btn-secondary flex-1"
                  (click)="downloadEbook()"
                  [disabled]="downloading()"
                >
                  {{ downloading() ? 'Descargando…' : 'Descargar' }}
                </button>
              </div>
            }
            <div class="mt-2 flex gap-2">
              <a [routerLink]="['/books', b.id, 'edit']" class="btn-secondary flex-1">Editar</a>
              <button type="button" class="btn-danger flex-1" (click)="deleting.set(true)">Eliminar</button>
            </div>
          </div>

          <div class="lg:col-span-2">
            <h1 id="book-title" class="text-3xl font-bold" itemprop="name">{{ b.title }}</h1>
            <p class="mt-1 text-lg text-slate-500 dark:text-slate-400" itemprop="author">{{ b.author }}</p>

            <dl class="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div>
                <dt class="text-slate-400">Tipo</dt>
                <dd class="font-medium">{{ b.type | bookTypeLabel }}</dd>
              </div>
              @if (b.isbn) {
                <div>
                  <dt class="text-slate-400">ISBN</dt>
                  <dd class="font-medium" itemprop="isbn">{{ b.isbn }}</dd>
                </div>
              }
              @if (b.pages) {
                <div>
                  <dt class="text-slate-400">Páginas</dt>
                  <dd class="font-medium" itemprop="numberOfPages">{{ b.pages }}</dd>
                </div>
              }
              @if (b.sagaName) {
                <div>
                  <dt class="text-slate-400">Saga</dt>
                  <dd class="font-medium">
                    {{ b.sagaName }}@if (b.sagaOrder) {&nbsp;(#{{ b.sagaOrder }})}
                  </dd>
                </div>
              }
              @if (b.categories.length) {
                <div class="col-span-2">
                  <dt class="text-slate-400">Categorías</dt>
                  <dd class="mt-1 flex flex-wrap gap-1.5">
                    @for (category of b.categories; track category.id) {
                      <span
                        class="rounded-full bg-primary-100 px-2.5 py-0.5 text-xs font-medium text-primary-700 dark:bg-primary-900/50 dark:text-primary-300"
                        itemprop="genre"
                      >
                        {{ category.name }}
                      </span>
                    }
                  </dd>
                </div>
              }
            </dl>

            @if (b.description) {
              <p class="mt-4 text-slate-600 dark:text-slate-300" itemprop="description">{{ b.description }}</p>
            }

            @if (sagaSiblings().length) {
              <section class="card mt-6 p-6" aria-labelledby="saga-title">
                <h2 id="saga-title" class="text-lg font-semibold">
                  Más de «{{ b.sagaName }}»
                </h2>
                <ul class="mt-3 space-y-2" role="list">
                  @for (sibling of sagaSiblings(); track sibling.id) {
                    <li>
                      <a
                        [routerLink]="['/books', sibling.id]"
                        class="flex items-center gap-2 text-sm text-primary-600 hover:underline dark:text-primary-400"
                      >
                        @if (sibling.sagaOrder) {
                          <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-semibold text-primary-700 dark:bg-primary-900/50 dark:text-primary-300">
                            {{ sibling.sagaOrder }}
                          </span>
                        }
                        {{ sibling.title }}
                      </a>
                    </li>
                  }
                </ul>
              </section>
            }

            <section class="card mt-6 p-6" aria-labelledby="ebook-title">
              <h2 id="ebook-title" class="flex items-center gap-2 text-lg font-semibold">
                <span class="text-primary-600 dark:text-primary-400" aria-hidden="true">
                  <app-icon name="document-text" [size]="18" />
                </span>
                Archivo del libro
              </h2>

              @if (b.ebookFormat) {
                <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {{ b.ebookFormat }} · {{ formatBytes(b.ebookSize) }}
                </p>
                <div class="mt-3 flex flex-wrap gap-2">
                  @if (ebookCache.available) {
                    @if (availableOffline()) {
                      <span
                        class="inline-flex items-center gap-1 rounded-full bg-dry-sage px-3 py-1.5 text-sm font-medium text-charcoal-brown dark:bg-dusty-olive/60 dark:text-dry-sage"
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
                <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Adjunta el PDF o EPUB para leerlo desde la aplicación y descargarlo cuando quieras.
                </p>
                <div class="mt-3">
                  <app-ebook-uploader [uploadFn]="attachFn" (uploaded)="onEbookUploaded($event)" />
                </div>
              }
            </section>

            <section class="card mt-6 p-6" aria-labelledby="session-title">
              <h2 id="session-title" class="text-lg font-semibold">Sesión de lectura</h2>

              @if (b.session; as session) {
                <div class="mt-4 space-y-4">
                  <div class="flex flex-wrap items-center gap-2" role="group" aria-label="Cambiar estado de lectura">
                    @for (status of statuses; track status) {
                      <button
                        type="button"
                        class="btn"
                        [class.bg-primary-600]="session.status === status"
                        [class.text-white]="session.status === status"
                        [class.btn-secondary]="session.status !== status"
                        [attr.aria-pressed]="session.status === status"
                        (click)="changeStatus(status)"
                      >
                        {{ status | readingStatusLabel }}
                      </button>
                    }
                  </div>

                  <div class="grid grid-cols-1 gap-4 text-sm sm:grid-cols-3" aria-live="polite">
                    @if (session.startDate) {
                      <p><span class="text-slate-400">Inicio:</span> {{ session.startDate | date: 'dd/MM/yyyy' }}</p>
                    }
                    @if (session.endDate) {
                      <p><span class="text-slate-400">Fin:</span> {{ session.endDate | date: 'dd/MM/yyyy' }}</p>
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

                  @if (session.status === 'FINISHED') {
                    <div>
                      <p class="label">Tu valoración</p>
                      <app-star-rating
                        [rating]="session.rating ?? 0"
                        (ratingChange)="updateRating($event)"
                      />
                    </div>
                  }

                  <div>
                    <label class="label" for="notes">Notas</label>
                    <textarea
                      id="notes"
                      rows="4"
                      class="input"
                      placeholder="Tus impresiones, citas favoritas…"
                      [ngModel]="session.notes"
                      (change)="updateNotes($event)"
                    ></textarea>
                  </div>
                </div>
              }
            </section>
          </div>
        </div>
      </article>
    } @else {
      <p class="text-slate-500" role="status">Cargando libro…</p>
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
  protected readonly book = signal<Book | null>(null);
  protected readonly sagaSiblings = signal<Book[]>([]);
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

  /** Sube el archivo al libro actual (lo usa el uploader). */
  protected readonly attachFn = (file: File) => this.ebookService.attach(Number(this.id()), file);

  constructor() {
    // La ruta /books/:id reutiliza este componente al navegar entre libros
    // (p. ej. entre los de una saga): recargar cada vez que cambia el id.
    effect(() => {
      this.id();
      this.book.set(null);
      this.sagaSiblings.set([]);
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

  /** Otros libros de la misma saga, ordenados por su posición. */
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

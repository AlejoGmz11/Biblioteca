import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild
} from '@angular/core';
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
import { ClickOutsideDirective } from '../../shared/directives/click-outside.directive';
import { BookTypeLabelPipe } from '../../shared/pipes/book-type-label.pipe';
import { ReadingStatusLabelPipe } from '../../shared/pipes/reading-status-label.pipe';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog.component';
import { StarRatingComponent } from '../../shared/components/star-rating.component';
import { IconComponent } from '../../shared/components/icon.component';

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

const DAY_MS = 86_400_000;

/** Día de calendario (sin zona horaria) de una fecha ISO `YYYY-MM-DD…`. */
function dayNumber(iso: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) / DAY_MS : null;
}

function todayNumber(): number {
  const now = new Date();
  return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / DAY_MS;
}

@Component({
  selector: 'app-book-detail-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    FormsModule,
    RouterLink,
    BookTypeLabelPipe,
    ReadingStatusLabelPipe,
    ClickOutsideDirective,
    ConfirmDialogComponent,
    StarRatingComponent,
    IconComponent,
    EbookUploaderComponent
  ],
  template: `
    @if (book(); as b) {
      <article aria-labelledby="book-title" itemscope itemtype="https://schema.org/Book">

        <!-- ── Migas + acciones ── -->
        <div class="mb-5 flex items-center justify-between gap-3">
          <nav aria-label="Miga de pan" class="flex min-w-0 items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
            <a
              routerLink="/books"
              class="flex shrink-0 items-center gap-1.5 transition-colors hover:text-primary-600 dark:hover:text-primary-400"
            >
              <app-icon name="book-open" [size]="14" /> Mis libros
            </a>
            <app-icon name="chevron-right" [size]="14" class="hidden shrink-0 sm:block" />
            <span aria-current="page" class="hidden min-w-0 truncate text-slate-700 dark:text-slate-200 sm:block">
              {{ b.title }}
            </span>
          </nav>

          <div class="flex shrink-0 items-center gap-2">
            <a [routerLink]="['/books', b.id, 'edit']" class="btn-secondary !px-3 sm:!px-4" aria-label="Editar libro">
              <app-icon name="pencil" [size]="15" />
              <span class="hidden sm:inline">Editar</span>
            </a>

            <div class="relative" (appClickOutside)="bookMenuOpen.set(false)">
              <button
                type="button"
                class="btn-secondary !px-2.5"
                aria-haspopup="menu"
                aria-controls="book-menu"
                aria-label="Más acciones"
                [attr.aria-expanded]="bookMenuOpen()"
                (click)="bookMenuOpen.set(!bookMenuOpen())"
                (keydown.escape)="bookMenuOpen.set(false)"
              >
                <app-icon name="ellipsis-horizontal" [size]="18" />
              </button>
              @if (bookMenuOpen()) {
                <div id="book-menu" role="menu" class="card absolute right-0 z-20 mt-2 w-48 overflow-hidden py-1 shadow-lg">
                  <button
                    role="menuitem"
                    type="button"
                    class="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-600 hover:bg-slate-100 dark:text-red-400 dark:hover:bg-slate-800"
                    (click)="bookMenuOpen.set(false); deleting.set(true)"
                  >
                    <app-icon name="trash" [size]="15" /> Eliminar libro
                  </button>
                </div>
              }
            </div>
          </div>
        </div>

        <!--
          Móvil: portada pequeña junto al título y el resto en una columna.
          Escritorio: columna izquierda fija (portada + acciones) y columna de contenido.
          Los contenedores "contents" dejan que sus hijos se coloquen directamente en la cuadrícula.
        -->
        <div
          class="grid grid-cols-[104px_minmax(0,1fr)] items-start gap-x-4 gap-y-4
                 sm:grid-cols-[144px_minmax(0,1fr)] lg:grid-cols-[264px_minmax(0,1fr)] lg:gap-x-10"
        >

          <!-- Portada y acciones principales -->
          <div class="contents lg:sticky lg:top-20 lg:block">
            <div class="col-start-1 row-start-1">
              @if (cover(); as url) {
                <img
                  [src]="url"
                  [alt]="'Portada de ' + b.title + ' de ' + b.author"
                  loading="lazy"
                  itemprop="image"
                  class="aspect-[2/3] w-full rounded-xl object-cover shadow-[0_10px_24px_rgba(88,47,14,0.26)]"
                />
              } @else {
                <div
                  class="flex aspect-[2/3] w-full items-center justify-center rounded-xl shadow-[0_10px_24px_rgba(88,47,14,0.26)]"
                  [style.background]="gradient()"
                  aria-hidden="true"
                >
                  <span class="select-none font-serif text-4xl text-white/40 lg:text-6xl">
                    {{ b.title.charAt(0).toUpperCase() }}
                  </span>
                </div>
              }
            </div>

            @if (hasCta()) {
              <div class="col-span-2 row-start-2 flex flex-col gap-2 sm:flex-row lg:mt-4 lg:flex-col">
                @if (b.ebookFormat && statusValue() !== 'PENDING') {
                  <a [routerLink]="['/books', b.id, 'read']" class="btn-primary">
                    <app-icon name="book-open" [size]="16" />
                    {{ statusValue() === 'READING' ? 'Continuar leyendo' : 'Leer de nuevo' }}
                  </a>
                } @else if (statusValue() === 'PENDING') {
                  <button type="button" class="btn-primary" (click)="startReading()">
                    <app-icon name="play" [size]="16" /> Empezar a leer
                  </button>
                } @else if (statusValue() === 'READING' && b.pages) {
                  <button type="button" class="btn-primary" (click)="focusPage()">
                    <app-icon name="pencil" [size]="16" /> Actualizar página
                  </button>
                }
                @if (b.ebookFormat) {
                  <button
                    type="button"
                    class="btn-secondary hidden lg:inline-flex"
                    (click)="downloadEbook()"
                    [disabled]="downloading()"
                  >
                    <app-icon name="download" [size]="16" />
                    {{ downloading() ? 'Descargando…' : 'Descargar' }}
                  </button>
                }
              </div>
            }
          </div>

          <!-- Contenido -->
          <div class="contents lg:block lg:min-w-0 lg:space-y-4">

            <!-- Título, autor, estado y progreso -->
            <div class="col-start-2 row-start-1 flex min-w-0 flex-col gap-3">
              <div>
                <h1
                  id="book-title"
                  class="font-serif text-2xl font-bold leading-tight sm:text-3xl lg:text-[34px]"
                  itemprop="name"
                >{{ b.title }}</h1>
                <p class="mt-1 text-base text-slate-500 dark:text-slate-400 lg:text-[17px]" itemprop="author">
                  {{ b.author }}
                </p>
              </div>

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
                  class="inline-flex items-center rounded-full border border-slate-300 px-2.5 py-0.5
                         text-xs text-slate-600 dark:border-slate-700 dark:text-slate-300"
                >{{ b.type | bookTypeLabel }}@if (b.ebookFormat) {&nbsp;· {{ b.ebookFormat }}}</span>
                @if (b.sagaName) {
                  <span
                    class="inline-flex max-w-full items-center rounded-full border border-slate-300 px-2.5 py-0.5
                           text-xs text-slate-600 dark:border-slate-700 dark:text-slate-300"
                  ><span class="truncate">{{ b.sagaName }}@if (b.sagaOrder) {&nbsp;#{{ b.sagaOrder }}}</span></span>
                }
              </div>

              @if (statusValue() === 'READING' && progressPct() !== null) {
                <div class="lg:max-w-lg">
                  <div class="mb-1.5 flex items-baseline justify-between text-[13px] text-slate-500 dark:text-slate-400">
                    <span>Progreso de lectura</span>
                    <span class="font-semibold tabular-nums text-toffee-brown dark:text-camel">{{ progressPct() }}%</span>
                  </div>
                  <div
                    class="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"
                    role="progressbar"
                    aria-label="Progreso de lectura"
                    aria-valuemin="0"
                    aria-valuemax="100"
                    [attr.aria-valuenow]="progressPct()"
                  >
                    <div class="h-full rounded-full bg-toffee-brown transition-all" [style.width.%]="progressPct()"></div>
                  </div>
                  <p class="mt-1.5 text-[13px] tabular-nums text-slate-500 dark:text-slate-400">
                    pág. {{ b.session?.currentPage ?? 0 }} de {{ b.pages }} · te faltan {{ pagesLeft() }}
                  </p>
                </div>
              }

              @if (b.session; as session) {
                @if (session.status === 'FINISHED') {
                  <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <app-star-rating [rating]="session.rating ?? 0" (ratingChange)="updateRating($event)" />
                    <span class="text-[13px] text-slate-500 dark:text-slate-400">Tu valoración</span>
                  </div>
                }
              }
            </div>

            <!-- Mi lectura -->
            @if (b.session; as session) {
              <section class="card col-span-2 p-5 sm:p-6" aria-labelledby="reading-title">
                <h2 id="reading-title" class="cat-section-label mb-3">Mi lectura</h2>

                <div
                  class="inline-flex gap-0.5 rounded-[10px] bg-slate-100 p-[3px] dark:bg-slate-800"
                  role="group"
                  aria-label="Cambiar estado de lectura"
                >
                  @for (status of statuses; track status) {
                    <button
                      type="button"
                      [class]="statusButtonClass(status, session.status)"
                      [attr.aria-pressed]="session.status === status"
                      (click)="changeStatus(status)"
                    >{{ status | readingStatusLabel }}</button>
                  }
                </div>

                <div class="mt-4 space-y-4" aria-live="polite">
                  @if (session.status === 'READING' && b.pages) {
                    <div>
                      <label class="label" for="current-page">Página actual</label>
                      <div class="flex items-center gap-2">
                        <button
                          type="button"
                          class="btn-secondary !h-9 !w-9 !p-0"
                          aria-label="Una página menos"
                          [disabled]="savingPage() || (session.currentPage ?? 0) <= 0"
                          (click)="stepPage(-1)"
                        ><app-icon name="minus" [size]="14" /></button>
                        <input
                          #pageInput
                          id="current-page"
                          type="number"
                          class="input !w-24 text-center font-semibold tabular-nums"
                          min="0"
                          [max]="b.pages"
                          [ngModel]="session.currentPage"
                          (change)="updateCurrentPage($event)"
                        />
                        <button
                          type="button"
                          class="btn-secondary !h-9 !w-9 !p-0"
                          aria-label="Una página más"
                          [disabled]="savingPage() || (session.currentPage ?? 0) >= b.pages"
                          (click)="stepPage(1)"
                        ><app-icon name="plus" [size]="14" /></button>
                        <span class="text-sm text-slate-500 dark:text-slate-400">de {{ b.pages }}</span>
                      </div>
                    </div>
                  }

                  @if (session.status === 'PENDING') {
                    <p class="text-sm text-slate-500 dark:text-slate-400">
                      Todavía no empezaste este libro. Al marcarlo como «Leyendo» se guarda la fecha de inicio.
                    </p>
                  }

                  @let days = daysReading();
                  @if (session.startDate || session.endDate) {
                    <div class="flex flex-wrap gap-2.5 text-sm">
                      @if (session.startDate) {
                        <div class="min-w-28 flex-1 rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/50">
                          <p class="text-xs text-slate-400">Inicio</p>
                          <p class="font-semibold tabular-nums">{{ session.startDate | date:'dd MMM yyyy' }}</p>
                        </div>
                      }
                      @if (session.endDate) {
                        <div class="min-w-28 flex-1 rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/50">
                          <p class="text-xs text-slate-400">Fin</p>
                          <p class="font-semibold tabular-nums">{{ session.endDate | date:'dd MMM yyyy' }}</p>
                        </div>
                      }
                      @if (days !== null) {
                        <div class="min-w-28 flex-1 rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/50">
                          <p class="text-xs text-slate-400">{{ session.status === 'FINISHED' ? 'Duración' : 'Llevas' }}</p>
                          <p class="font-semibold tabular-nums">{{ daysLabel(days, session.status) }}</p>
                        </div>
                      }
                    </div>
                  }
                </div>
              </section>
            }

            <!-- Sobre el libro -->
            <section class="card col-span-2 p-5 sm:p-6" aria-labelledby="about-title">
              <h2 id="about-title" class="cat-section-label mb-3">Sobre el libro</h2>

              @if (b.description) {
                <p class="mb-4 max-w-prose text-sm text-slate-600 dark:text-slate-300" itemprop="description">
                  {{ b.description }}
                </p>
              }

              <dl class="grid grid-cols-2 gap-x-6 gap-y-3.5 text-sm lg:grid-cols-4">
                @if (b.pages) {
                  <div>
                    <dt class="text-xs text-slate-400">Páginas</dt>
                    <dd class="mt-0.5 font-semibold" itemprop="numberOfPages">{{ b.pages }}</dd>
                  </div>
                }
                <div>
                  <dt class="text-xs text-slate-400">Formato</dt>
                  <dd class="mt-0.5 font-semibold">{{ b.type | bookTypeLabel }}@if (b.ebookFormat) {&nbsp;· {{ b.ebookFormat }}}</dd>
                </div>
                @if (b.isbn) {
                  <div>
                    <dt class="text-xs text-slate-400">ISBN</dt>
                    <dd class="mt-0.5 font-semibold" itemprop="isbn">{{ b.isbn }}</dd>
                  </div>
                }
                @if (b.sagaName) {
                  <div>
                    <dt class="text-xs text-slate-400">Saga</dt>
                    <dd class="mt-0.5 font-semibold">{{ b.sagaName }}@if (b.sagaOrder) {&nbsp;· #{{ b.sagaOrder }}}</dd>
                  </div>
                }
              </dl>

              @if (b.categories.length) {
                <div class="mt-4 flex flex-wrap gap-1.5">
                  @for (category of b.categories; track category.id) {
                    <span
                      class="rounded-full bg-primary-100 px-2.5 py-0.5 text-xs font-medium text-primary-700
                             dark:bg-primary-900/50 dark:text-primary-300"
                      itemprop="genre"
                    >{{ category.name }}</span>
                  }
                </div>
              }
            </section>

            <!-- Notas -->
            @if (b.session; as session) {
              <section class="card col-span-2 p-5 sm:p-6">
                <label for="notes" class="cat-section-label mb-3 block">Notas</label>
                <textarea
                  id="notes"
                  rows="4"
                  class="input"
                  placeholder="Tus impresiones, citas favoritas, personajes que te gustaron…"
                  [ngModel]="session.notes"
                  (change)="updateNotes($event)"
                ></textarea>
              </section>
            }

            <!-- Archivo del libro -->
            <section
              class="card relative col-span-2 p-4 sm:px-5"
              [class.z-10]="fileMenuOpen()"
              aria-label="Archivo del libro"
            >
              <div class="flex flex-wrap items-center gap-3">
                <span
                  class="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-primary-100
                         text-primary-600 dark:bg-primary-900/40 dark:text-primary-300"
                  aria-hidden="true"
                >
                  <app-icon name="document-text" [size]="20" />
                </span>

                <div class="min-w-0 flex-1">
                  @if (b.ebookFormat) {
                    <p class="text-sm font-semibold">Archivo {{ b.ebookFormat }}</p>
                    <p class="text-[13px] text-slate-500 dark:text-slate-400" role="status">
                      {{ formatBytes(b.ebookSize) }} ·
                      @if (savingOffline()) {
                        Guardando para leer sin conexión…
                      } @else if (availableOffline()) {
                        Disponible sin conexión
                      } @else {
                        para leer en la app y descargar
                      }
                    </p>
                  } @else {
                    <p class="text-sm font-semibold">Sin archivo adjunto</p>
                    <p class="text-[13px] text-slate-500 dark:text-slate-400">
                      Adjuntá un PDF o EPUB para leerlo desde la app.
                    </p>
                  }
                </div>

                <div class="flex w-full items-center gap-1.5 sm:w-auto">
                  @if (b.ebookFormat) {
                    <button
                      type="button"
                      class="btn-secondary !px-3 !py-1.5 !text-[13px]"
                      (click)="downloadEbook()"
                      [disabled]="downloading()"
                    >
                      <app-icon name="download" [size]="14" />
                      {{ downloading() ? 'Descargando…' : 'Descargar' }}
                    </button>

                    <div class="relative" (appClickOutside)="fileMenuOpen.set(false)">
                      <button
                        type="button"
                        class="btn-secondary !px-2.5 !py-1.5"
                        aria-haspopup="menu"
                        aria-controls="file-menu"
                        aria-label="Más opciones del archivo"
                        [attr.aria-expanded]="fileMenuOpen()"
                        (click)="fileMenuOpen.set(!fileMenuOpen())"
                        (keydown.escape)="fileMenuOpen.set(false)"
                      >
                        <app-icon name="ellipsis-horizontal" [size]="18" />
                      </button>
                      @if (fileMenuOpen()) {
                        <div id="file-menu" role="menu" class="card absolute right-0 z-20 mt-2 w-64 overflow-hidden py-1 shadow-lg">
                          @if (ebookCache.available) {
                            @if (availableOffline()) {
                              <button
                                role="menuitem"
                                type="button"
                                class="block w-full px-4 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                                (click)="fileMenuOpen.set(false); removeOffline()"
                              >Quitar del dispositivo</button>
                            } @else {
                              <button
                                role="menuitem"
                                type="button"
                                class="block w-full px-4 py-2 text-left text-sm hover:bg-slate-100 disabled:opacity-50 dark:hover:bg-slate-800"
                                [disabled]="savingOffline()"
                                (click)="fileMenuOpen.set(false); saveOffline()"
                              >Guardar para leer sin conexión</button>
                            }
                          }
                          <button
                            role="menuitem"
                            type="button"
                            class="block w-full px-4 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                            (click)="fileMenuOpen.set(false); uploaderOpen.set(!uploaderOpen())"
                          >{{ uploaderOpen() ? 'Cancelar sustitución' : 'Sustituir archivo' }}</button>
                          <button
                            role="menuitem"
                            type="button"
                            class="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-slate-100 dark:text-red-400 dark:hover:bg-slate-800"
                            (click)="fileMenuOpen.set(false); removingEbook.set(true)"
                          >Quitar archivo</button>
                        </div>
                      }
                    </div>
                  } @else {
                    <button
                      type="button"
                      class="btn-secondary !px-3 !py-1.5 !text-[13px]"
                      [attr.aria-expanded]="uploaderOpen()"
                      (click)="uploaderOpen.set(!uploaderOpen())"
                    >
                      <app-icon [name]="uploaderOpen() ? 'x-mark' : 'plus'" [size]="14" />
                      {{ uploaderOpen() ? 'Cancelar' : 'Adjuntar archivo' }}
                    </button>
                  }
                </div>
              </div>

              @if (uploaderOpen()) {
                <div class="mt-3">
                  @if (b.ebookFormat) {
                    <app-ebook-uploader
                      [uploadFn]="attachFn"
                      buttonLabel="Elegir nuevo archivo"
                      (uploaded)="onEbookUploaded($event)"
                    />
                  } @else {
                    <app-ebook-uploader [uploadFn]="attachFn" (uploaded)="onEbookUploaded($event)" />
                  }
                </div>
              }
            </section>

            <!-- Más de la saga -->
            @if (sagaSiblings().length) {
              <section class="card col-span-2 p-5 sm:p-6" aria-labelledby="saga-title">
                <h2 id="saga-title" class="cat-section-label mb-3">Más de «{{ b.sagaName }}»</h2>
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
              </section>
            }
          </div>
        </div>
      </article>

    } @else {
      <!-- Cargando -->
      <div class="animate-pulse" role="status" aria-label="Cargando libro…">
        <div class="mb-5 flex items-center justify-between">
          <div class="h-5 w-40 rounded bg-slate-200 dark:bg-slate-700"></div>
          <div class="flex gap-2">
            <div class="h-9 w-10 rounded-lg bg-slate-200 dark:bg-slate-700 sm:w-24"></div>
            <div class="h-9 w-10 rounded-lg bg-slate-200 dark:bg-slate-700"></div>
          </div>
        </div>
        <div class="flex items-start gap-x-4 lg:gap-x-10">
          <div class="aspect-[2/3] w-[104px] shrink-0 rounded-xl bg-slate-200 dark:bg-slate-700 sm:w-36 lg:w-[264px]"></div>
          <div class="min-w-0 flex-1 space-y-4">
            <div class="space-y-3">
              <div class="h-8 w-3/4 rounded bg-slate-200 dark:bg-slate-700"></div>
              <div class="h-5 w-1/2 rounded bg-slate-100 dark:bg-slate-800"></div>
              <div class="flex gap-1.5">
                <div class="h-5 w-16 rounded-full bg-slate-100 dark:bg-slate-800"></div>
                <div class="h-5 w-20 rounded-full bg-slate-100 dark:bg-slate-800"></div>
              </div>
            </div>
            <div class="h-40 rounded-xl bg-slate-100 dark:bg-slate-800"></div>
            <div class="h-40 rounded-xl bg-slate-100 dark:bg-slate-800"></div>
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

  protected readonly book = signal<Book | null>(null);
  protected readonly sagaSiblings = signal<Book[]>([]);
  protected readonly deleting = signal(false);
  protected readonly bookMenuOpen = signal(false);
  protected readonly fileMenuOpen = signal(false);
  protected readonly uploaderOpen = signal(false);
  protected readonly removingEbook = signal(false);
  protected readonly downloading = signal(false);
  protected readonly savingOffline = signal(false);
  protected readonly savingPage = signal(false);

  private readonly pageInput = viewChild<ElementRef<HTMLInputElement>>('pageInput');

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
    const total = b?.pages;
    if (!total || total <= 0) return null;
    return Math.min(100, Math.round(((b?.session?.currentPage ?? 0) / total) * 100));
  });
  protected readonly pagesLeft = computed((): number | null => {
    const b = this.book();
    const total = b?.pages;
    if (!total) return null;
    return Math.max(0, total - (b?.session?.currentPage ?? 0));
  });
  /** Días de lectura: hasta hoy si está leyéndose, hasta la fecha de fin si terminó. */
  protected readonly daysReading = computed((): number | null => {
    const session = this.book()?.session;
    const start = session?.startDate ? dayNumber(session.startDate) : null;
    if (start === null) return null;
    const end = session?.status === 'FINISHED' && session.endDate ? dayNumber(session.endDate) : todayNumber();
    if (end === null || end < start) return null;
    return end - start;
  });
  /** Acción principal bajo la portada: solo existe si hay algo útil que ofrecer. */
  protected readonly hasCta = computed(() => {
    const b = this.book();
    if (!b) return false;
    switch (this.statusValue()) {
      case 'PENDING':
        return true;
      case 'READING':
        return !!b.ebookFormat || !!b.pages;
      default:
        return !!b.ebookFormat;
    }
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
      this.deleting.set(false);
      this.bookMenuOpen.set(false);
      this.fileMenuOpen.set(false);
      this.uploaderOpen.set(false);
      this.removingEbook.set(false);
      this.load();
    });
  }

  protected statusButtonClass(status: ReadingStatus, current: ReadingStatus): string {
    const base = 'rounded-lg px-3.5 py-1.5 text-[13px] font-medium transition-colors';
    if (status !== current) {
      return `${base} text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white`;
    }
    switch (status) {
      case 'READING':
        return `${base} bg-toffee-brown text-white shadow-sm`;
      case 'FINISHED':
        return `${base} bg-dusty-olive text-white shadow-sm`;
      default:
        return `${base} bg-white text-slate-900 shadow-sm dark:bg-slate-600 dark:text-white`;
    }
  }

  protected daysLabel(days: number, status: ReadingStatus): string {
    if (days === 0 && status !== 'FINISHED') return 'Desde hoy';
    const shown = Math.max(1, days);
    return shown === 1 ? '1 día' : `${shown} días`;
  }

  onEbookUploaded(book: Book): void {
    this.book.set(book);
    this.uploaderOpen.set(false);
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

  changeStatus(status: ReadingStatus, onChanged?: () => void): void {
    const current = this.book();
    if (!current || current.session?.status === status) {
      return;
    }
    this.bookService.updateSession(current.id, { status }).subscribe({
      next: (session) => {
        this.book.update((b) => (b ? { ...b, session } : b));
        this.toast.success('Estado actualizado');
        onChanged?.();
      },
      error: () => this.toast.error('No se pudo actualizar el estado')
    });
  }

  /** Marca el libro como «Leyendo» y, si tiene archivo, abre el lector. */
  startReading(): void {
    const current = this.book();
    if (!current) {
      return;
    }
    this.changeStatus('READING', () => {
      if (current.ebookFormat) {
        void this.router.navigate(['/books', current.id, 'read']);
      }
    });
  }

  focusPage(): void {
    const input = this.pageInput()?.nativeElement;
    input?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    input?.focus({ preventScroll: true });
  }

  updateRating(rating: number): void {
    this.patchSession({ rating: rating || null });
  }

  updateCurrentPage(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.patchSession({ currentPage: Number.isFinite(value) ? value : null });
  }

  stepPage(delta: number): void {
    const current = this.book();
    if (!current?.session || this.savingPage()) {
      return;
    }
    const page = current.session.currentPage ?? 0;
    const next = Math.min(current.pages ?? Number.MAX_SAFE_INTEGER, Math.max(0, page + delta));
    if (next === page) {
      return;
    }
    this.savingPage.set(true);
    this.patchSession({ currentPage: next }, () => this.savingPage.set(false));
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

  private patchSession(patch: Parameters<BookService['updateSession']>[1], onSettled?: () => void): void {
    const current = this.book();
    if (!current) {
      return;
    }
    this.bookService.updateSession(current.id, patch).subscribe({
      next: (session) => {
        this.book.update((b) => (b ? { ...b, session } : b));
        onSettled?.();
      },
      error: () => {
        this.toast.error('No se pudo guardar el cambio');
        onSettled?.();
      }
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

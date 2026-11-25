import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild
} from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { Book, Stats } from '../../core/models';
import { StatsService } from '../../core/services/stats.service';
import { BookService } from '../../core/services/book.service';
import { AuthService } from '../../core/services/auth.service';
import { SeoService } from '../../core/services/seo.service';
import { StatCardComponent } from '../../shared/components/stat-card.component';
import { IconComponent } from '../../shared/components/icon.component';
import { ThemeService } from '../../core/services/theme.service';

/** Tope de libros en «Leyendo ahora»; el grid los reparte en filas de 4. */
const READING_NOW_LIMIT = 48;

interface ChartTheme {
  grid: string;
  tick: string;
  accent: string;
  accentBorder: string;
  accentFill: string;
  /** Pendiente, Leyendo, Terminado. */
  status: [string, string, string];
  statusBorder: string;
  /** Sin actividad, 1, 2, 3+ libros. */
  heat: [string, string, string, string];
}

// El modo claro usa solo la paleta crema/salvia/arena (y tonos más oscuros de esos
// mismos matices para bordes); el oscuro conserva la paleta tierra original.
const CHART_THEMES: Record<'light' | 'dark', ChartTheme> = {
  light: {
    grid: 'rgba(46, 50, 33, 0.08)',
    tick: '#5a6040',
    accent: '#d4a373',
    accentBorder: '#b8834f',
    accentFill: 'rgba(212, 163, 115, 0.25)',
    status: ['#e9edc9', '#d4a373', '#ccd5ae'],
    statusBorder: '#aeb98a',
    heat: ['#e9edc9', '#ccd5ae', '#d4a373', '#8a5a2b']
  },
  dark: {
    grid: 'rgba(255, 255, 255, 0.07)',
    tick: '#a4ac86',
    accent: '#936639',
    accentBorder: '#936639',
    accentFill: 'rgba(147, 102, 57, 0.12)',
    status: ['#b6ad90', '#936639', '#656d4a'],
    statusBorder: '#333d29',
    heat: ['#edecdd', '#c9a97f', '#936639', '#582f0e']
  }
};

const HEAT_LABELS = ['Sin actividad', '1 libro', '2 libros', '3+ libros'];

@Component({
  selector: 'app-dashboard-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, DecimalPipe, RouterLink, StatCardComponent, IconComponent],
  template: `
    <section aria-labelledby="dashboard-title">
      <!-- Hero con fotografía de biblioteca -->
      <div class="relative overflow-hidden rounded-2xl shadow-lg">
        <img
          src="/images/hero-library.jpg"
          alt=""
          aria-hidden="true"
          class="absolute inset-0 h-full w-full object-cover"
        />
        <!-- Velo: crema en claro (texto oscuro encima), carbón en oscuro -->
        <div
          class="absolute inset-0 bg-gradient-to-r from-white/95 via-white/85 to-slate-50/60
                 dark:from-charcoal-brown/95 dark:via-charcoal-brown/75 dark:to-dark-walnut/40"
          aria-hidden="true"
        ></div>
        <div class="relative flex flex-wrap items-end justify-between gap-4 px-6 py-10 sm:px-10 sm:py-14">
          <div>
            <p class="text-xs font-semibold uppercase tracking-[0.2em] text-primary-700 dark:text-dry-sage">
              Tu biblioteca personal
            </p>
            <h1 id="dashboard-title" class="mt-2 text-3xl font-bold text-slate-900 dark:text-white sm:text-4xl">
              Hola, {{ username() }}
            </h1>
            <p class="mt-2 max-w-xl text-sm text-slate-600 dark:text-dry-sage">
              Sigue tu progreso, puntúa tus lecturas y descubre cuánto has leído.
            </p>
          </div>
          <div class="flex flex-wrap gap-3">
            <a routerLink="/books/new" class="btn-primary">+ Añadir libro</a>
            <a
              routerLink="/books"
              class="btn border border-slate-300 bg-white/80 text-slate-700 hover:bg-white
                     dark:border-dry-sage/60 dark:bg-transparent dark:text-dry-sage dark:hover:bg-white/10"
            >
              Ver mis libros
            </a>
          </div>
        </div>
      </div>

      @if (stats(); as s) {
        <!-- Desde 1536 px, dos columnas: contenido principal + columna lateral derecha -->
        <div [class]="s.totalBooks > 0 ? railLayout : ''">
        <div class="min-w-0">
        <!-- Sección: Leyendo ahora -->
        @if (readingBooks().length > 0) {
          <div class="mt-6 flex items-center gap-3">
            <span class="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
              Leyendo ahora
            </span>
            <div class="flex-1 border-t border-slate-200 dark:border-slate-700"></div>
          </div>
          <div class="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            @for (book of readingBooks(); track book.id) {
              <a
                [routerLink]="['/books', book.id]"
                class="card flex gap-3 p-4 transition-shadow hover:shadow-md"
              >
                @if (bookService.coverUrl(book); as url) {
                  <img
                    [src]="url"
                    [alt]="book.title"
                    class="h-16 w-11 shrink-0 rounded object-cover"
                  />
                } @else {
                  <div
                    class="flex h-16 w-11 shrink-0 items-center justify-center rounded bg-primary-100 text-xl dark:bg-primary-900/40"
                    aria-hidden="true"
                  >📖</div>
                }
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-semibold">{{ book.title }}</p>
                  <p class="truncate text-xs text-slate-500 dark:text-slate-400 mb-2">{{ book.author }}</p>
                  <div
                    class="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"
                    role="progressbar"
                    [attr.aria-valuenow]="readingProgress(book)"
                    aria-valuemin="0"
                    aria-valuemax="100"
                  >
                    <div
                      class="h-full rounded-full bg-primary-500 transition-[width]"
                      [style.width.%]="readingProgress(book)"
                    ></div>
                  </div>
                  <div class="mt-1 flex justify-between text-[10px] text-slate-400 dark:text-slate-500">
                    @if (book.session?.currentPage && book.pages) {
                      <span>pág. {{ book.session!.currentPage }} / {{ book.pages }}</span>
                      <span>{{ readingProgress(book) }}%</span>
                    } @else {
                      <span>En curso</span>
                    }
                  </div>
                </div>
              </a>
            }
          </div>
        }

        <!-- Sección: Estadísticas -->
        <div class="mt-6 flex items-center gap-3">
          <span class="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
            Estadísticas
          </span>
          <div class="flex-1 border-t border-slate-200 dark:border-slate-700"></div>
        </div>
        <div class="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <app-stat-card label="Total de libros" [value]="s.totalBooks" icon="books" color="primary" />
          <app-stat-card label="Leyendo ahora" [value]="s.booksByStatus.READING" icon="book-open" color="muted" />
          <app-stat-card label="Terminados" [value]="s.booksByStatus.FINISHED" icon="bookmark" color="olive" />
          <app-stat-card
            label="Páginas leídas"
            [value]="(s.totalPagesRead | number) ?? 0"
            [hint]="'Media de ' + (s.avgDaysPerBook | number: '1.0-1') + ' días por libro'"
            icon="document-text"
            color="sage"
          />
        </div>

        @if (s.totalBooks > 0) {
          <!-- Meta anual (en pantallas anchas pasa a la columna lateral) -->
          @if (readingGoal() > 0) {
            <div class="2xl:hidden">
            <div class="mt-6 flex items-center gap-3">
              <span class="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                Meta {{ currentYear() }}
              </span>
              <div class="flex-1 border-t border-slate-200 dark:border-slate-700"></div>
            </div>
            <div class="card mt-3 p-5">
              <div class="flex items-center justify-between gap-4">
                <div class="flex-1">
                  <div class="flex items-baseline gap-2">
                    <span class="text-3xl font-bold">{{ s.booksFinishedThisYear }}</span>
                    <span class="text-sm text-slate-500 dark:text-slate-400">/ {{ readingGoal() }} libros este año</span>
                  </div>
                  <div
                    class="mt-3 h-3 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"
                    role="progressbar"
                    [attr.aria-valuenow]="goalPercent(s)"
                    aria-valuemin="0"
                    aria-valuemax="100"
                    [attr.aria-label]="'Meta anual: ' + goalPercent(s) + '%'"
                  >
                    <div
                      class="h-full rounded-full bg-primary-500 transition-[width] duration-700"
                      [style.width.%]="goalPercent(s)"
                    ></div>
                  </div>
                  <p class="mt-2 text-xs text-slate-400 dark:text-slate-500">
                    {{ goalPercent(s) }}% completado · {{ goalStatus(s) }}
                  </p>
                </div>
                <div class="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-primary-100 text-primary-700 dark:bg-primary-900/50 dark:text-primary-300" aria-hidden="true">
                  <app-icon name="trophy" [size]="28" />
                </div>
              </div>
            </div>
            </div>
          }

          <!-- Sección: Gráficos -->
          <div class="mt-6 flex items-center gap-3">
            <span class="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
              Actividad
            </span>
            <div class="flex-1 border-t border-slate-200 dark:border-slate-700"></div>
          </div>

          <!-- Fila 1: libros por mes + páginas por mes -->
          <div class="mt-3 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <section class="card p-6" aria-label="Libros terminados por mes">
              <h2 class="mb-4 flex items-center gap-2 font-semibold">
                <span class="text-primary-600 dark:text-primary-400" aria-hidden="true">
                  <app-icon name="chart-bar" [size]="18" />
                </span>
                Libros terminados por mes
              </h2>
              <canvas
                #monthlyChart
                role="img"
                aria-label="Gráfico de barras con los libros terminados en los últimos 12 meses"
              ></canvas>
            </section>
            <section class="card p-6" aria-label="Páginas leídas por mes">
              <h2 class="mb-4 flex items-center gap-2 font-semibold">
                <span class="text-primary-600 dark:text-primary-400" aria-hidden="true">
                  <app-icon name="chart-bar" [size]="18" />
                </span>
                Páginas leídas por mes
              </h2>
              <canvas
                #pagesChart
                role="img"
                aria-label="Gráfico de línea con las páginas leídas en los últimos 12 meses"
              ></canvas>
            </section>
          </div>

          <!-- Fila 2: distribución de estado + valoraciones -->
          <div class="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <section class="card p-6" aria-label="Distribución por estado">
              <h2 class="mb-4 flex items-center gap-2 font-semibold">
                <span class="text-primary-600 dark:text-primary-400" aria-hidden="true">
                  <app-icon name="chart-pie" [size]="18" />
                </span>
                Distribución por estado
              </h2>
              <!-- Alto fijo: así el donut no estira la fila ni deja un hueco en la tarjeta vecina -->
              <div class="relative h-64">
                <canvas
                  #statusChart
                  role="img"
                  aria-label="Gráfico circular con la distribución de libros por estado de lectura"
                ></canvas>
              </div>
            </section>
            <section class="card flex flex-col p-6" aria-label="Distribución de valoraciones">
              <div class="mb-4 flex items-baseline justify-between gap-3">
                <h2 class="flex items-center gap-2 font-semibold">
                  <span class="text-primary-600 dark:text-primary-400" aria-hidden="true">
                    <app-icon name="star" [size]="18" />
                  </span>
                  Mis valoraciones
                </h2>
                <span class="text-xs text-slate-500 dark:text-slate-400">
                  {{ ratedTotal() }} valorados
                </span>
              </div>
              <!-- Cada fila lleva a «Mis libros» filtrado por esa valoración -->
              <ul class="flex flex-1 list-none flex-col justify-between gap-1" role="list">
                @for (row of ratingRows(); track row.stars) {
                  <li>
                    <a
                      routerLink="/books"
                      [queryParams]="{ rating: row.stars }"
                      class="group flex items-center gap-3 rounded-lg px-2 py-2 transition-colors
                             hover:bg-slate-100 dark:hover:bg-slate-800"
                      [attr.aria-label]="'Ver los ' + row.count + ' libros con ' + row.stars + (row.stars === 1 ? ' estrella' : ' estrellas')"
                    >
                      <span class="w-8 shrink-0 text-sm font-semibold tabular-nums">
                        {{ row.stars }}
                        <span class="text-primary-600 dark:text-camel" aria-hidden="true">★</span>
                      </span>
                      <span class="h-3 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                        <span
                          class="block h-full rounded-full bg-primary-500 transition-[width] duration-500"
                          [style.width.%]="row.percent"
                        ></span>
                      </span>
                      <span class="w-8 shrink-0 text-right text-sm font-semibold tabular-nums">
                        {{ row.count }}
                      </span>
                      <span
                        class="text-slate-400 transition-transform group-hover:translate-x-0.5 dark:text-slate-500"
                        aria-hidden="true"
                      >›</span>
                    </a>
                  </li>
                }
              </ul>
              <p class="mt-3 text-xs text-slate-500 dark:text-slate-400">
                Elige una fila para ver esos libros.
              </p>
            </section>
          </div>

          <!-- Fila 3: heatmap anual -->
          <section class="card mt-6 p-6" aria-label="Actividad de lectura anual">
            <h2 class="mb-4 flex items-center gap-2 font-semibold">
              <span class="text-primary-600 dark:text-primary-400" aria-hidden="true">
                <app-icon name="calendar" [size]="18" />
              </span>
              Actividad anual
            </h2>
            <div class="overflow-x-auto">
              <div
                #heatmapContainer
                class="grid gap-[3px]"
                role="img"
                aria-label="Mapa de calor de actividad de lectura en los últimos 365 días"
              ></div>
            </div>
            <div class="mt-3 flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
              <span>Menos</span>
              <div class="flex gap-1">
                @for (lvl of heatLevels(); track lvl.label) {
                  <div
                    class="h-3 w-3 rounded-sm"
                    [style.background-color]="lvl.color"
                    [attr.aria-label]="lvl.label"
                  ></div>
                }
              </div>
              <span>Más</span>
            </div>
          </section>
        } @else {
          <!-- Estado vacío temático -->
          <div class="card mt-6 grid grid-cols-1 overflow-hidden sm:grid-cols-2">
            <img
              src="/images/empty-books.jpg"
              alt="Pila de libros sobre una mesa"
              loading="lazy"
              class="h-48 w-full object-cover sm:h-full"
            />
            <div class="flex flex-col items-start justify-center gap-3 p-8">
              <h2 class="text-xl font-semibold">Tu estantería está esperando</h2>
              <p class="text-sm text-slate-500 dark:text-slate-400">
                Todavía no has registrado ningún libro. Añade el primero y empieza a llenar
                tu biblioteca: aquí verás tus estadísticas y tu progreso de lectura.
              </p>
              <a routerLink="/books/new" class="btn-primary mt-2">Añadir mi primer libro</a>
            </div>
          </div>
        }
        </div>

        @if (s.totalBooks > 0) {
          <!-- Columna lateral: a la derecha y fija al hacer scroll desde 1536 px;
               en pantallas más angostas queda debajo del contenido -->
          <aside class="2xl:sticky 2xl:top-20" aria-label="Resumen de lectura">
            <!-- Meta anual: versión compacta, solo en pantallas anchas -->
            <div class="hidden 2xl:block">
              <div class="mt-6 flex items-center gap-3">
                <span class="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                  Meta {{ currentYear() }}
                </span>
                <div class="flex-1 border-t border-slate-200 dark:border-slate-700"></div>
              </div>
              @if (readingGoal() > 0) {
                <div class="card mt-3 p-5">
                  <div class="flex items-start justify-between gap-3">
                    <div>
                      <p class="text-3xl font-bold leading-none">{{ s.booksFinishedThisYear }}</p>
                      <p class="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
                        de {{ readingGoal() }} libros este año
                      </p>
                    </div>
                    <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-100 text-primary-700 dark:bg-primary-900/50 dark:text-primary-300" aria-hidden="true">
                      <app-icon name="trophy" [size]="22" />
                    </div>
                  </div>
                  <div
                    class="mt-4 h-3 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"
                    role="progressbar"
                    [attr.aria-valuenow]="goalPercent(s)"
                    aria-valuemin="0"
                    aria-valuemax="100"
                    [attr.aria-label]="'Meta anual: ' + goalPercent(s) + '%'"
                  >
                    <div
                      class="h-full rounded-full bg-primary-500 transition-[width] duration-700"
                      [style.width.%]="goalPercent(s)"
                    ></div>
                  </div>
                  <p class="mt-2 text-xs text-slate-400 dark:text-slate-500">
                    {{ goalPercent(s) }}% completado · {{ goalStatus(s) }}
                  </p>
                </div>
              } @else {
                <a routerLink="/profile" class="card mt-3 flex items-center gap-3 p-5 transition-shadow hover:shadow-md">
                  <span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-100 text-primary-700 dark:bg-primary-900/50 dark:text-primary-300" aria-hidden="true">
                    <app-icon name="trophy" [size]="22" />
                  </span>
                  <span>
                    <span class="block text-sm font-semibold">Fija tu meta anual</span>
                    <span class="block text-xs text-slate-500 dark:text-slate-400">
                      Elige en tu perfil cuántos libros quieres leer este año.
                    </span>
                  </span>
                </a>
              }
            </div>

            <!-- Últimos terminados, con su valoración -->
            @if (recentlyFinished().length > 0) {
              <div class="mt-6 flex items-center gap-3">
                <span class="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                  Últimos terminados
                </span>
                <div class="flex-1 border-t border-slate-200 dark:border-slate-700"></div>
              </div>
              <ul class="card mt-3 grid list-none gap-1 p-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-1" role="list">
                @for (book of recentlyFinished(); track book.bookId) {
                  <li class="min-w-0">
                    <a
                      [routerLink]="['/books', book.bookId]"
                      class="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      @if (bookService.coverUrl(book); as url) {
                        <img [src]="url" alt="" loading="lazy" class="h-14 w-10 shrink-0 rounded object-cover" />
                      } @else {
                        <div
                          class="flex h-14 w-10 shrink-0 items-center justify-center rounded bg-primary-100 text-lg dark:bg-primary-900/40"
                          aria-hidden="true"
                        >📖</div>
                      }
                      <div class="min-w-0 flex-1">
                        <p class="truncate text-sm font-semibold">{{ book.title }}</p>
                        <p class="truncate text-xs text-slate-500 dark:text-slate-400">{{ book.author }}</p>
                        <p class="mt-1 flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                          @if (book.rating) {
                            <span class="font-semibold tabular-nums text-slate-700 dark:text-slate-200">
                              <span class="text-primary-600 dark:text-camel" aria-hidden="true">★</span>
                              {{ book.rating | number: '1.0-1' }}<span class="sr-only"> de 5 estrellas</span>
                            </span>
                          } @else {
                            <span>Sin valorar</span>
                          }
                          @if (book.endDate) {
                            <span class="tabular-nums">{{ book.endDate | date: 'dd MMM yyyy' }}</span>
                          }
                        </p>
                      </div>
                    </a>
                  </li>
                }
              </ul>
            }
          </aside>
        }
        </div>
      } @else if (loadError()) {
        <div class="card mt-8 p-8 text-center" role="alert">
          <span class="inline-flex text-camel" aria-hidden="true">
            <app-icon name="warning" [size]="32" />
          </span>
          <p class="mt-2 font-medium">No se pudieron cargar las estadísticas</p>
          <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Comprueba que el servidor esté disponible e inténtalo de nuevo.
          </p>
          <button type="button" class="btn-primary mt-4" (click)="retry()">Reintentar</button>
        </div>
      } @else {
        <!-- Skeleton loading -->
        <div class="mt-6 animate-pulse space-y-6" aria-busy="true" aria-label="Cargando estadísticas">
          <!-- Skeleton: stat cards -->
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            @for (i of [1,2,3,4]; track i) {
              <div class="card p-5">
                <div class="h-4 w-24 rounded bg-slate-200 dark:bg-slate-700"></div>
                <div class="mt-3 h-8 w-16 rounded bg-slate-200 dark:bg-slate-700"></div>
              </div>
            }
          </div>
          <!-- Skeleton: charts -->
          <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
            @for (i of [1,2]; track i) {
              <div class="card p-6">
                <div class="mb-4 h-5 w-40 rounded bg-slate-200 dark:bg-slate-700"></div>
                <div class="h-48 w-full rounded bg-slate-100 dark:bg-slate-800"></div>
              </div>
            }
          </div>
          <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
            @for (i of [1,2]; track i) {
              <div class="card p-6">
                <div class="mb-4 h-5 w-40 rounded bg-slate-200 dark:bg-slate-700"></div>
                <div class="h-48 w-full rounded bg-slate-100 dark:bg-slate-800"></div>
              </div>
            }
          </div>
        </div>
      }
    </section>
  `
})
export class DashboardPage {
  private readonly statsService = inject(StatsService);
  protected readonly bookService = inject(BookService);
  private readonly authService = inject(AuthService);
  private readonly theme = inject(ThemeService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly stats = signal<Stats | null>(null);
  protected readonly readingBooks = signal<Book[]>([]);
  protected readonly loadError = signal(false);
  protected readonly username = signal(this.authService.user()?.username ?? 'lector');
  protected readonly readingGoal = signal(this.authService.user()?.readingGoal ?? 0);
  protected readonly currentYear = signal(new Date().getFullYear());

  private readonly chartTheme = computed(
    () => CHART_THEMES[this.theme.darkMode() ? 'dark' : 'light']
  );

  protected readonly heatLevels = computed(() =>
    this.chartTheme().heat.map((color, i) => ({ label: HEAT_LABELS[i], color }))
  );

  /** Filas de 5★ a 1★ con su conteo y el ancho de barra relativo a la más larga. */
  protected readonly ratingRows = computed(() => {
    const dist = this.stats()?.ratingDistribution ?? {};
    const counts = [5, 4, 3, 2, 1].map((stars) => ({ stars, count: dist[String(stars)] ?? 0 }));
    const max = Math.max(1, ...counts.map((c) => c.count));
    return counts.map((c) => ({ ...c, percent: (c.count / max) * 100 }));
  });

  protected readonly ratedTotal = computed(() =>
    this.ratingRows().reduce((sum, row) => sum + row.count, 0)
  );

  /** Dos columnas (contenido + lateral de 20rem) solo cuando hay sitio de sobra. */
  protected readonly railLayout =
    '2xl:grid 2xl:grid-cols-[minmax(0,1fr)_20rem] 2xl:items-start 2xl:gap-6';

  protected readonly recentlyFinished = computed(() => this.stats()?.recentlyFinished ?? []);

  private readonly monthlyChart   = viewChild<ElementRef<HTMLCanvasElement>>('monthlyChart');
  private readonly pagesChart     = viewChild<ElementRef<HTMLCanvasElement>>('pagesChart');
  private readonly statusChart    = viewChild<ElementRef<HTMLCanvasElement>>('statusChart');
  private readonly heatmapContainer = viewChild<ElementRef<HTMLDivElement>>('heatmapContainer');

  private charts: { destroy(): void }[] = [];
  /** Descarta renders viejos si el tema cambia mientras se carga chart.js. */
  private renderToken = 0;

  constructor() {
    inject(SeoService).apply({
      title: 'Panel — MyLibrary',
      description: 'Estadísticas de tu biblioteca: libros leídos, páginas y progreso mensual.',
      path: '/dashboard'
    });

    afterNextRender(() => this.loadStats());

    // Los gráficos leen los colores al crearse: al cambiar de tema hay que redibujarlos.
    effect(() => {
      this.theme.darkMode();
      const stats = untracked(this.stats);
      if (stats && this.charts.length > 0) {
        void this.renderCharts(stats);
      }
    });

    this.destroyRef.onDestroy(() => this.destroyCharts());
  }

  private destroyCharts(): void {
    this.charts.forEach((chart) => chart.destroy());
    this.charts = [];
  }

  retry(): void {
    this.loadError.set(false);
    this.loadStats();
  }

  protected readingProgress(book: Book): number {
    const current = book.session?.currentPage;
    const total = book.pages;
    if (!current || !total) return 0;
    return Math.min(100, Math.round((current / total) * 100));
  }

  protected goalPercent(s: Stats): number {
    const goal = this.readingGoal();
    if (!goal) return 0;
    return Math.min(100, Math.round((s.booksFinishedThisYear / goal) * 100));
  }

  protected booksLeft(s: Stats): number {
    return Math.max(0, this.readingGoal() - s.booksFinishedThisYear);
  }

  protected goalStatus(s: Stats): string {
    const left = this.booksLeft(s);
    if (left === 0) return '¡Meta alcanzada!';
    return left === 1 ? '1 libro restante' : `${left} libros restantes`;
  }

  private loadStats(): void {
    forkJoin({
      stats: this.statsService.dashboard(),
      reading: this.bookService.list({ status: 'READING', size: READING_NOW_LIMIT })
    }).subscribe({
      next: ({ stats, reading }) => {
        this.stats.set(stats);
        this.readingBooks.set(reading.content);
        setTimeout(() => void this.renderCharts(stats));
      },
      error: () => this.loadError.set(true)
    });
  }

  private async renderCharts(stats: Stats): Promise<void> {
    const monthly  = this.monthlyChart()?.nativeElement;
    const pages    = this.pagesChart()?.nativeElement;
    const status   = this.statusChart()?.nativeElement;
    const heatmap  = this.heatmapContainer()?.nativeElement;

    if (!monthly || !status) return;

    const token = ++this.renderToken;
    const { Chart } = await import('chart.js/auto');
    if (token !== this.renderToken) return;
    this.destroyCharts();

    const colors = this.chartTheme();
    const gridColor = colors.grid;
    const tickColor = colors.tick;
    const monthLabels = stats.booksPerMonth.map((m) => m.month.slice(5)); // MM only

    // --- Bar: libros por mes ---
    const bar = new Chart(monthly, {
      type: 'bar',
      data: {
        labels: monthLabels,
        datasets: [{
          label: 'Libros',
          data: stats.booksPerMonth.map((m) => m.count),
          backgroundColor: colors.accent,
          borderColor: colors.accentBorder,
          borderWidth: 1,
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        scales: {
          y: { beginAtZero: true, ticks: { precision: 0, color: tickColor }, grid: { color: gridColor } },
          x: { ticks: { color: tickColor }, grid: { display: false } }
        },
        plugins: { legend: { display: false } }
      }
    });

    this.charts.push(bar);

    // --- Line: páginas por mes ---
    if (pages && stats.pagesPerMonth) {
      const lineChart = new Chart(pages, {
        type: 'line',
        data: {
          labels: monthLabels,
          datasets: [{
            label: 'Páginas',
            data: stats.pagesPerMonth.map((m) => m.count),
            borderColor: colors.accentBorder,
            backgroundColor: colors.accentFill,
            tension: 0.4,
            fill: true,
            pointBackgroundColor: colors.accentBorder
          }]
        },
        options: {
          responsive: true,
          scales: {
            y: { beginAtZero: true, ticks: { precision: 0, color: tickColor }, grid: { color: gridColor } },
            x: { ticks: { color: tickColor }, grid: { display: false } }
          },
          plugins: { legend: { display: false } }
        }
      });
      this.charts.push(lineChart);
    }

    // --- Doughnut: distribución por estado ---
    const doughnut = new Chart(status, {
      type: 'doughnut',
      data: {
        labels: ['Pendiente', 'Leyendo', 'Terminado'],
        datasets: [{
          data: [
            stats.booksByStatus.PENDING,
            stats.booksByStatus.READING,
            stats.booksByStatus.FINISHED
          ],
          backgroundColor: colors.status,
          borderColor: colors.statusBorder,
          borderWidth: 1.5
        }]
      },
      options: {
        responsive: true,
        // El alto lo fija el contenedor (h-64), no la proporción 1:1 del donut
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { color: tickColor, boxWidth: 14, padding: 16 } }
        }
      }
    });
    this.charts.push(doughnut);

    // --- Heatmap: actividad anual ---
    if (heatmap && stats.activityDays) {
      this.renderHeatmap(heatmap, stats.activityDays, colors.heat);
    }
  }

  private renderHeatmap(
    container: HTMLDivElement,
    days: { date: string; count: number }[],
    colors: readonly string[]
  ): void {
    const cellSize = 12;
    const gap = 3;

    // Group by week (columns), starting on Monday
    const weeks: { date: string; count: number }[][] = [];
    let week: { date: string; count: number }[] = [];

    const firstDay = new Date(days[0].date);
    const startOffset = (firstDay.getDay() + 6) % 7; // 0 = Mon
    for (let i = 0; i < startOffset; i++) week.push({ date: '', count: -1 });

    for (const day of days) {
      week.push(day);
      if (week.length === 7) {
        weeks.push(week);
        week = [];
      }
    }
    if (week.length) {
      while (week.length < 7) week.push({ date: '', count: -1 });
      weeks.push(week);
    }

    container.style.gridTemplateColumns = `repeat(${weeks.length}, ${cellSize}px)`;
    container.style.gridTemplateRows    = `repeat(7, ${cellSize}px)`;
    container.innerHTML = '';

    for (let col = 0; col < weeks.length; col++) {
      for (let row = 0; row < 7; row++) {
        const cell = document.createElement('div');
        cell.style.width  = `${cellSize}px`;
        cell.style.height = `${cellSize}px`;
        cell.style.borderRadius = '2px';
        cell.style.gridColumn = `${col + 1}`;
        cell.style.gridRow    = `${row + 1}`;

        const d = weeks[col][row];
        if (!d || d.count < 0) {
          cell.style.background = 'transparent';
        } else {
          const lvl = d.count === 0 ? 0 : d.count === 1 ? 1 : d.count === 2 ? 2 : 3;
          cell.style.background = colors[lvl];
          if (d.date) cell.title = `${d.date}: ${d.count} libro${d.count !== 1 ? 's' : ''}`;
        }

        container.appendChild(cell);
      }
    }
  }
}

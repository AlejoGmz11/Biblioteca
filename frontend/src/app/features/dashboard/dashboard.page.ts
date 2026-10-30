import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  inject,
  signal,
  viewChild
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Stats } from '../../core/models';
import { StatsService } from '../../core/services/stats.service';
import { AuthService } from '../../core/services/auth.service';
import { SeoService } from '../../core/services/seo.service';
import { StatCardComponent } from '../../shared/components/stat-card.component';
import { IconComponent } from '../../shared/components/icon.component';

@Component({
  selector: 'app-dashboard-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, RouterLink, StatCardComponent, IconComponent],
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
        <div
          class="absolute inset-0 bg-gradient-to-r from-charcoal-brown/95 via-charcoal-brown/75 to-dark-walnut/40"
          aria-hidden="true"
        ></div>
        <div class="relative px-6 py-12 sm:px-10 sm:py-16">
          <p class="text-xs font-semibold uppercase tracking-[0.2em] text-dry-sage">
            Tu biblioteca personal
          </p>
          <h1 id="dashboard-title" class="mt-2 text-3xl font-bold text-white sm:text-4xl">
            Hola, {{ username() }}
          </h1>
          <p class="mt-3 max-w-xl text-dry-sage">
            Cada libro que registras es un estante más en tu biblioteca. Sigue tu progreso,
            puntúa tus lecturas y descubre cuánto has leído.
          </p>
          <div class="mt-6 flex flex-wrap gap-3">
            <a routerLink="/books/new" class="btn-primary">+ Añadir libro</a>
            <a
              routerLink="/books"
              class="btn border border-dry-sage/60 text-dry-sage hover:bg-white/10"
            >
              Ver mis libros
            </a>
          </div>
        </div>
      </div>

      @if (stats(); as s) {
        <!-- Tarjetas de estadísticas -->
        <div class="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <app-stat-card label="Total de libros" [value]="s.totalBooks" icon="books" />
          <app-stat-card label="Leyendo ahora" [value]="s.booksByStatus.READING" icon="book-open" />
          <app-stat-card label="Terminados" [value]="s.booksByStatus.FINISHED" icon="bookmark" />
          <app-stat-card
            label="Páginas leídas"
            [value]="(s.totalPagesRead | number) ?? 0"
            [hint]="'Media de ' + (s.avgDaysPerBook | number: '1.0-1') + ' días por libro'"
            icon="document-text"
          />
        </div>

        @if (s.totalBooks > 0) {
          <!-- Gráficos -->
          <div class="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
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
            <section class="card p-6" aria-label="Distribución por estado">
              <h2 class="mb-4 flex items-center gap-2 font-semibold">
                <span class="text-primary-600 dark:text-primary-400" aria-hidden="true">
                  <app-icon name="chart-pie" [size]="18" />
                </span>
                Distribución por estado
              </h2>
              <canvas
                #statusChart
                role="img"
                aria-label="Gráfico circular con la distribución de libros por estado de lectura"
              ></canvas>
            </section>
          </div>
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
        <p class="mt-8 text-slate-500" role="status">Cargando estadísticas…</p>
      }
    </section>
  `
})
export class DashboardPage {
  private readonly statsService = inject(StatsService);
  private readonly authService = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly stats = signal<Stats | null>(null);
  protected readonly loadError = signal(false);
  protected readonly username = signal(this.authService.user()?.username ?? 'lector');

  private readonly monthlyChart = viewChild<ElementRef<HTMLCanvasElement>>('monthlyChart');
  private readonly statusChart = viewChild<ElementRef<HTMLCanvasElement>>('statusChart');

  constructor() {
    inject(SeoService).apply({
      title: 'Panel — MyLibrary',
      description: 'Estadísticas de tu biblioteca: libros leídos, páginas y progreso mensual.',
      path: '/dashboard'
    });

    // Charts only render in the browser (SSR safe)
    afterNextRender(() => this.loadStats());
  }

  retry(): void {
    this.loadError.set(false);
    this.loadStats();
  }

  private loadStats(): void {
    this.statsService.dashboard().subscribe({
      next: (stats) => {
        this.stats.set(stats);
        // Wait for the canvases to exist after the @if renders
        setTimeout(() => void this.renderCharts(stats));
      },
      error: () => this.loadError.set(true)
    });
  }

  private async renderCharts(stats: Stats): Promise<void> {
    const monthly = this.monthlyChart()?.nativeElement;
    const status = this.statusChart()?.nativeElement;
    if (!monthly || !status) {
      return;
    }
    const { Chart } = await import('chart.js/auto');

    const bar = new Chart(monthly, {
      type: 'bar',
      data: {
        labels: stats.booksPerMonth.map((m) => m.month),
        datasets: [
          {
            label: 'Libros terminados',
            data: stats.booksPerMonth.map((m) => m.count),
            backgroundColor: '#936639', // toffee-brown
            borderRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
        plugins: { legend: { display: false } }
      }
    });

    const doughnut = new Chart(status, {
      type: 'doughnut',
      data: {
        labels: ['Pendiente', 'Leyendo', 'Terminado'],
        datasets: [
          {
            data: [
              stats.booksByStatus.PENDING,
              stats.booksByStatus.READING,
              stats.booksByStatus.FINISHED
            ],
            // khaki-beige (pendiente), toffee-brown (leyendo), dusty-olive (terminado)
            backgroundColor: ['#b6ad90', '#936639', '#656d4a']
          }
        ]
      },
      options: { responsive: true }
    });

    this.destroyRef.onDestroy(() => {
      bar.destroy();
      doughnut.destroy();
    });
  }
}

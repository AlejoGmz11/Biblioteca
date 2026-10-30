import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ExportService } from '../../core/services/export.service';
import { SeoService } from '../../core/services/seo.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-export-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-xl" aria-labelledby="export-title">
      <h1 id="export-title" class="text-2xl font-bold">Exportar datos</h1>
      <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Descarga una copia de todos tus libros y sesiones de lectura.
      </p>

      <div class="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <article class="card p-6">
          <h2 class="font-semibold">CSV</h2>
          <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Ideal para hojas de cálculo (Excel, Google Sheets).
          </p>
          <button
            type="button"
            class="btn-primary mt-4 w-full"
            [disabled]="downloading() === 'csv'"
            (click)="download('csv')"
          >
            {{ downloading() === 'csv' ? 'Descargando…' : 'Descargar CSV' }}
          </button>
        </article>

        <article class="card p-6">
          <h2 class="font-semibold">JSON</h2>
          <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Formato estructurado con todos los detalles.
          </p>
          <button
            type="button"
            class="btn-primary mt-4 w-full"
            [disabled]="downloading() === 'json'"
            (click)="download('json')"
          >
            {{ downloading() === 'json' ? 'Descargando…' : 'Descargar JSON' }}
          </button>
        </article>
      </div>
    </section>
  `
})
export class ExportPage {
  private readonly exportService = inject(ExportService);
  private readonly toast = inject(ToastService);

  protected readonly downloading = signal<'csv' | 'json' | null>(null);

  constructor() {
    inject(SeoService).apply({
      title: 'Exportar datos — MyLibrary',
      description: 'Exporta tu biblioteca personal en CSV o JSON.',
      path: '/export'
    });
  }

  download(format: 'csv' | 'json'): void {
    this.downloading.set(format);
    this.exportService.download(format).subscribe({
      next: (blob) => {
        this.downloading.set(null);
        this.exportService.saveBlob(blob, `mylibrary-export.${format}`);
        this.toast.success('Exportación descargada');
      },
      error: () => {
        this.downloading.set(null);
        this.toast.error('No se pudo generar la exportación');
      }
    });
  }
}

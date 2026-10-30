import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { HttpEvent, HttpEventType } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiResponse, Book } from '../../core/models';
import { EBOOK_ACCEPT, EbookService } from '../../core/services/ebook.service';
import { ToastService } from '../../core/services/toast.service';
import { IconComponent } from './icon.component';

/**
 * Zona de arrastrar y soltar para PDF/EPUB con barra de progreso. Quien lo
 * use decide qué hacer con el archivo (adjuntar a un libro o crear uno)
 * mediante `uploadFn`; el componente solo valida, sube y notifica.
 */
@Component({
  selector: 'app-ebook-uploader',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div
      class="flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition-colors"
      [class.border-primary-500]="dragging()"
      [class.bg-primary-50]="dragging()"
      [class.dark:bg-primary-950]="dragging()"
      [class.border-slate-300]="!dragging()"
      [class.dark:border-slate-700]="!dragging()"
      (dragover)="onDragOver($event)"
      (dragleave)="dragging.set(false)"
      (drop)="onDrop($event)"
    >
      <span class="text-slate-400 dark:text-slate-500" aria-hidden="true">
        <app-icon name="document-text" [size]="36" [strokeWidth]="1.4" />
      </span>
      <p class="mt-2 text-sm text-slate-500 dark:text-slate-400" id="ebook-uploader-hint">
        {{ hint() }}
      </p>

      @if (uploading()) {
        <div class="mt-4 w-full max-w-xs" role="progressbar" aria-label="Progreso de la subida"
             [attr.aria-valuenow]="progress()" aria-valuemin="0" aria-valuemax="100">
          <div class="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
            <div class="h-full rounded-full bg-primary-600 transition-[width] duration-200" [style.width.%]="progress()"></div>
          </div>
          <p class="mt-1 text-xs text-slate-400" aria-live="polite">
            {{ progress() < 100 ? 'Subiendo… ' + progress() + '%' : 'Procesando archivo…' }}
          </p>
        </div>
      } @else {
        <label class="btn-secondary mt-3 cursor-pointer">
          {{ buttonLabel() }}
          <input
            type="file"
            class="sr-only"
            [accept]="accept"
            aria-describedby="ebook-uploader-hint"
            (change)="onFileSelected($event)"
          />
        </label>
      }
      <p class="mt-2 text-xs text-slate-400">PDF o EPUB · máx. 100 MB</p>
    </div>
  `
})
export class EbookUploaderComponent {
  private readonly ebookService = inject(EbookService);
  private readonly toast = inject(ToastService);

  protected readonly accept = EBOOK_ACCEPT;

  readonly hint = input('Arrastra aquí tu PDF o EPUB, o selecciónalo desde tu equipo');
  readonly buttonLabel = input('Seleccionar archivo');
  /** Cómo subir el archivo: adjuntar a un libro existente o crear uno nuevo. */
  readonly uploadFn = input.required<(file: File) => Observable<HttpEvent<ApiResponse<Book>>>>();

  readonly uploaded = output<Book>();

  protected readonly dragging = signal(false);
  protected readonly uploading = signal(false);
  protected readonly progress = signal(0);

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(true);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) {
      this.upload(file);
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) {
      this.upload(file);
    }
  }

  private upload(file: File): void {
    const error = this.ebookService.validate(file);
    if (error) {
      this.toast.error(error);
      return;
    }
    this.uploading.set(true);
    this.progress.set(0);

    this.uploadFn()(file).subscribe({
      next: (event) => {
        if (event.type === HttpEventType.UploadProgress && event.total) {
          this.progress.set(Math.round((100 * event.loaded) / event.total));
        } else if (event.type === HttpEventType.Response && event.body) {
          this.uploading.set(false);
          this.uploaded.emit(event.body.data);
        }
      },
      error: (err) => {
        this.uploading.set(false);
        this.toast.error(err?.error?.message ?? 'No se pudo subir el archivo');
      }
    });
  }
}

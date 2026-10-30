import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { ImageService } from '../../core/services/image.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-image-uploader',
  changeDetection: ChangeDetectionStrategy.OnPush,
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
      @if (previewUrl()) {
        <img
          [src]="previewUrl()"
          alt="Vista previa de la portada seleccionada"
          class="mb-3 max-h-48 rounded-lg object-contain"
        />
      } @else {
        <p class="mb-2 text-sm text-slate-500 dark:text-slate-400" id="uploader-hint">
          Arrastra una imagen aquí o selecciónala desde tu equipo
        </p>
      }
      <label class="btn-secondary cursor-pointer">
        {{ uploading() ? 'Subiendo…' : 'Seleccionar imagen' }}
        <input
          type="file"
          class="sr-only"
          accept="image/jpeg,image/png,image/webp,image/gif"
          aria-describedby="uploader-hint"
          [disabled]="uploading()"
          (change)="onFileSelected($event)"
        />
      </label>
      <p class="mt-2 text-xs text-slate-400">JPEG, PNG, WEBP o GIF · máx. 5 MB</p>
    </div>
  `
})
export class ImageUploaderComponent {
  private readonly imageService = inject(ImageService);
  private readonly toast = inject(ToastService);

  readonly initialPreview = input<string | null>(null);
  readonly uploaded = output<string>();

  protected readonly dragging = signal(false);
  protected readonly uploading = signal(false);
  private readonly localPreview = signal<string | null>(null);

  protected previewUrl(): string | null {
    return this.localPreview() ?? this.initialPreview();
  }

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
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      this.upload(file);
    }
  }

  private upload(file: File): void {
    if (file.size > 5 * 1024 * 1024) {
      this.toast.error('La imagen supera el tamaño máximo de 5 MB');
      return;
    }
    this.uploading.set(true);
    const reader = new FileReader();
    reader.onload = () => this.localPreview.set(reader.result as string);
    reader.readAsDataURL(file);

    this.imageService.upload(file).subscribe({
      next: (filename) => {
        this.uploading.set(false);
        this.uploaded.emit(filename);
        this.toast.success('Imagen subida correctamente');
      },
      error: () => {
        this.uploading.set(false);
        this.localPreview.set(null);
        this.toast.error('No se pudo subir la imagen');
      }
    });
  }
}

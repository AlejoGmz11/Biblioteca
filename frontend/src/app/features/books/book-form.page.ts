import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Book, BookType, Category, Saga } from '../../core/models';
import { BookService } from '../../core/services/book.service';
import { CategoryService } from '../../core/services/category.service';
import { SagaService } from '../../core/services/saga.service';
import { SeoService } from '../../core/services/seo.service';
import { ToastService } from '../../core/services/toast.service';
import { EbookService } from '../../core/services/ebook.service';
import { ImageUploaderComponent } from '../../shared/components/image-uploader.component';
import { EbookUploaderComponent } from '../../shared/components/ebook-uploader.component';
import { IconComponent } from '../../shared/components/icon.component';

@Component({
  selector: 'app-book-form-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, ImageUploaderComponent, EbookUploaderComponent, IconComponent],
  template: `
    <section class="mx-auto max-w-3xl" aria-labelledby="book-form-title">
      <nav aria-label="Miga de pan" class="text-sm text-slate-500">
        <a routerLink="/books" class="hover:underline">Mis libros</a>
        <span aria-hidden="true"> / </span>
        <span aria-current="page">{{ isEdit() ? 'Editar' : 'Nuevo libro' }}</span>
      </nav>

      <h1 id="book-form-title" class="mt-2 text-2xl font-bold">
        {{ isEdit() ? 'Editar libro' : 'Añadir un libro' }}
      </h1>

      @if (!isEdit()) {
        <!-- Crear desde archivo: el backend extrae título/autor y se salta al formulario ya relleno -->
        <section class="card mt-6 p-6" aria-labelledby="import-title">
          <h2 id="import-title" class="flex items-center gap-2 font-semibold">
            <span class="text-primary-600 dark:text-primary-400" aria-hidden="true">
              <app-icon name="document-text" [size]="18" />
            </span>
            Importar desde un PDF o EPUB
          </h2>
          <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Sube el archivo y crearemos el libro con el título y el autor que traiga; después podrás
            revisarlos. O rellena el formulario a mano más abajo.
          </p>
          <div class="mt-4">
            <app-ebook-uploader
              [uploadFn]="createFromFileFn"
              hint="Arrastra aquí el archivo o selecciónalo"
              (uploaded)="onImported($event)"
            />
          </div>
        </section>

        <div class="my-6 flex items-center gap-3 text-xs uppercase tracking-widest text-slate-400" aria-hidden="true">
          <span class="h-px flex-1 bg-slate-200 dark:bg-slate-800"></span>
          o a mano
          <span class="h-px flex-1 bg-slate-200 dark:bg-slate-800"></span>
        </div>
      }

      <form [formGroup]="form" (ngSubmit)="submit()" class="card mt-6 space-y-5 p-6" novalidate>
        <div class="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div class="sm:col-span-2">
            <label class="label" for="title">Título *</label>
            <input
              id="title" type="text" class="input" formControlName="title"
              [attr.aria-invalid]="isInvalid('title')"
              [attr.aria-errormessage]="isInvalid('title') ? 'title-error' : null"
            />
            @if (isInvalid('title')) {
              <p id="title-error" class="error-text" role="alert">El título es obligatorio</p>
            }
          </div>

          <div>
            <label class="label" for="author">Autor *</label>
            <input
              id="author" type="text" class="input" formControlName="author"
              [attr.aria-invalid]="isInvalid('author')"
              [attr.aria-errormessage]="isInvalid('author') ? 'author-error' : null"
            />
            @if (isInvalid('author')) {
              <p id="author-error" class="error-text" role="alert">El autor es obligatorio</p>
            }
          </div>

          <div>
            <label class="label" for="isbn">ISBN</label>
            <input id="isbn" type="text" class="input" formControlName="isbn" />
          </div>

          <div>
            <label class="label" for="pages">Páginas</label>
            <input id="pages" type="number" min="1" class="input" formControlName="pages" />
          </div>

          <div>
            <label class="label" for="type">Tipo *</label>
            <select id="type" class="input" formControlName="type">
              <option value="PHYSICAL">Físico</option>
              <option value="DIGITAL">Digital</option>
              <option value="AUDIOBOOK">Audiolibro</option>
            </select>
          </div>

          <div>
            <label class="label" for="saga">Saga / trilogía (opcional)</label>
            <input
              id="saga"
              type="text"
              class="input"
              formControlName="saga"
              list="saga-options"
              placeholder="P. ej. Crónicas de Dune"
              aria-describedby="saga-hint"
            />
            <datalist id="saga-options">
              @for (saga of sagas(); track saga.id) {
                <option [value]="saga.name"></option>
              }
            </datalist>
            <p id="saga-hint" class="mt-1 text-xs text-slate-400">
              Déjalo vacío si el libro es autoconclusivo
            </p>
          </div>

          <div>
            <label class="label" for="sagaOrder">Nº dentro de la saga</label>
            <input id="sagaOrder" type="number" min="1" max="100" class="input" formControlName="sagaOrder" />
          </div>

          <fieldset class="sm:col-span-2">
            <legend class="label">Categorías</legend>
            <p class="mb-2 text-xs text-slate-400" id="categories-hint">
              Toca para seleccionar; puedes marcar varias
            </p>
            <div class="flex flex-wrap gap-2" role="group" aria-describedby="categories-hint">
              @for (category of categories(); track category.id) {
                <button
                  type="button"
                  [class]="chipClasses(category.id)"
                  [attr.aria-pressed]="isSelected(category.id)"
                  (click)="toggleCategory(category.id)"
                >
                  {{ category.name }}
                </button>
              }
            </div>
          </fieldset>

          <div class="sm:col-span-2">
            <label class="label" for="description">Descripción</label>
            <textarea id="description" rows="4" class="input" formControlName="description"></textarea>
          </div>
        </div>

        <fieldset>
          <legend class="label">Portada</legend>
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label class="label" for="imageUrl">URL de la imagen</label>
              <input
                id="imageUrl" type="url" class="input" formControlName="imageUrl"
                placeholder="https://…"
                aria-describedby="image-hint"
              />
              <p id="image-hint" class="mt-1 text-xs text-slate-400">
                Introduce una URL o sube un archivo; la URL tiene prioridad
              </p>
            </div>
            <app-image-uploader
              [initialPreview]="uploadedPreview()"
              (uploaded)="onImageUploaded($event)"
            />
          </div>
        </fieldset>

        <div class="flex justify-end gap-3 border-t border-slate-200 pt-5 dark:border-slate-800">
          <a routerLink="/books" class="btn-secondary">Cancelar</a>
          <button type="submit" class="btn-primary" [disabled]="saving()">
            {{ saving() ? 'Guardando…' : isEdit() ? 'Guardar cambios' : 'Crear libro' }}
          </button>
        </div>
      </form>
    </section>
  `
})
export class BookFormPage {
  private readonly fb = inject(FormBuilder);
  private readonly bookService = inject(BookService);
  private readonly categoryService = inject(CategoryService);
  private readonly sagaService = inject(SagaService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly seo = inject(SeoService);
  private readonly ebookService = inject(EbookService);

  /** Crea el libro a partir del archivo (lo usa el uploader de importación). */
  protected readonly createFromFileFn = (file: File) => this.ebookService.createFromFile(file);

  onImported(book: Book): void {
    this.toast.success('Libro creado. Revisa el título y el autor extraídos del archivo');
    void this.router.navigate(['/books', book.id, 'edit']);
  }

  /** Bound from the route parameter via withComponentInputBinding. */
  readonly id = input<string>();

  protected readonly isEdit = computed(() => !!this.id());
  protected readonly categories = signal<Category[]>([]);
  protected readonly sagas = signal<Saga[]>([]);
  protected readonly selectedCategories = signal<number[]>([]);
  protected readonly saving = signal(false);
  protected readonly uploadedPreview = signal<string | null>(null);

  private imagePath: string | null = null;

  protected readonly form = this.fb.group({
    title: this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(255)]),
    author: this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(255)]),
    isbn: this.fb.control<string | null>(null, Validators.maxLength(20)),
    pages: this.fb.control<number | null>(null, [Validators.min(1)]),
    type: this.fb.nonNullable.control<BookType>('PHYSICAL'),
    saga: this.fb.control<string | null>(null, Validators.maxLength(255)),
    sagaOrder: this.fb.control<number | null>(null, [Validators.min(1), Validators.max(100)]),
    imageUrl: this.fb.control<string | null>(null),
    description: this.fb.control<string | null>(null, Validators.maxLength(5000))
  });

  constructor() {
    this.categoryService.list().subscribe((categories) => this.categories.set(categories));
    this.sagaService.list().subscribe((sagas) => this.sagas.set(sagas));

    // input() is not resolved yet in the constructor; defer to microtask
    queueMicrotask(() => {
      const id = this.id();
      this.seo.apply({
        title: id ? 'Editar libro — MyLibrary' : 'Nuevo libro — MyLibrary',
        path: id ? `/books/${id}/edit` : '/books/new'
      });
      if (id) {
        this.loadBook(Number(id));
      }
    });
  }

  isInvalid(control: 'title' | 'author'): boolean {
    const c = this.form.controls[control];
    return c.invalid && c.touched;
  }

  toggleCategory(id: number): void {
    this.selectedCategories.update((selected) =>
      selected.includes(id) ? selected.filter((c) => c !== id) : [...selected, id]
    );
  }

  isSelected(id: number): boolean {
    return this.selectedCategories().includes(id);
  }

  /** Chip redondeado, a juego con las etiquetas de categoría del detalle. */
  chipClasses(id: number): string {
    const base =
      'rounded-full border px-3 py-1.5 text-sm font-medium transition-colors duration-150 ';
    return this.isSelected(id)
      ? base +
          'border-primary-600 bg-primary-600 text-white shadow-sm ' +
          'dark:border-primary-500 dark:bg-primary-500 dark:text-slate-950'
      : base +
          'border-slate-300 text-slate-600 hover:border-primary-400 hover:text-primary-700 ' +
          'dark:border-slate-700 dark:text-slate-300 dark:hover:border-primary-500 dark:hover:text-primary-300';
  }

  onImageUploaded(filename: string): void {
    this.imagePath = filename;
    this.uploadedPreview.set(this.bookService.coverUrl({ imageUrl: null, imagePath: filename }));
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    const value = this.form.getRawValue();
    const payload = {
      ...value,
      imagePath: this.imagePath,
      categoryIds: this.selectedCategories()
    };

    const request$ = this.isEdit()
      ? this.bookService.update(Number(this.id()), payload)
      : this.bookService.create(payload);

    request$.subscribe({
      next: (book) => {
        this.saving.set(false);
        this.toast.success(this.isEdit() ? 'Libro actualizado' : 'Libro creado');
        void this.router.navigate(['/books', book.id]);
      },
      error: (err) => {
        this.saving.set(false);
        this.toast.error(err?.error?.message ?? 'No se pudo guardar el libro');
      }
    });
  }

  private loadBook(id: number): void {
    this.bookService.get(id).subscribe((book) => {
      this.imagePath = book.imagePath;
      this.uploadedPreview.set(this.bookService.coverUrl(book));
      this.selectedCategories.set(book.categories.map((c) => c.id));
      this.form.patchValue({
        title: book.title,
        author: book.author,
        isbn: book.isbn,
        pages: book.pages,
        type: book.type,
        saga: book.sagaName,
        sagaOrder: book.sagaOrder,
        imageUrl: book.imageUrl,
        description: book.description
      });
    });
  }
}

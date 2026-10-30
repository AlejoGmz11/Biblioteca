import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Category } from '../../core/models';
import { CategoryService } from '../../core/services/category.service';
import { SeoService } from '../../core/services/seo.service';
import { ToastService } from '../../core/services/toast.service';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog.component';
import { IconComponent } from '../../shared/components/icon.component';

/** Colores de la paleta para los avatares, asignados de forma estable por nombre. */
const AVATAR_COLORS = [
  'bg-toffee-brown',
  'bg-dusty-olive',
  'bg-camel',
  'bg-saddle-brown',
  'bg-dry-sage-2',
  'bg-ebony'
];

@Component({
  selector: 'app-categories-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, ConfirmDialogComponent, IconComponent],
  template: `
    <section aria-labelledby="categories-title">
      <div class="flex items-center gap-3">
        <span
          class="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-100 text-primary-700 dark:bg-primary-900/50 dark:text-primary-300"
          aria-hidden="true"
        >
          <app-icon name="tag" [size]="20" />
        </span>
        <div>
          <h1 id="categories-title" class="text-2xl font-bold">Categorías</h1>
          <p class="text-sm text-slate-500 dark:text-slate-400">
            Las predefinidas no se pueden modificar ni eliminar.
          </p>
        </div>
      </div>

      <div class="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <form [formGroup]="form" (ngSubmit)="submit()" class="card h-fit space-y-4 p-6" novalidate>
          <h2 class="font-semibold">{{ editing() ? 'Editar categoría' : 'Nueva categoría' }}</h2>
          <div>
            <label class="label" for="cat-name">Nombre *</label>
            <input
              id="cat-name" type="text" class="input" formControlName="name"
              placeholder="P. ej. Novela negra"
              [attr.aria-invalid]="nameInvalid()"
              [attr.aria-errormessage]="nameInvalid() ? 'cat-name-error' : null"
            />
            @if (nameInvalid()) {
              <p id="cat-name-error" class="error-text" role="alert">El nombre es obligatorio</p>
            }
          </div>
          <div class="flex gap-2">
            <button type="submit" class="btn-primary flex-1" [disabled]="saving()">
              {{ editing() ? 'Guardar' : 'Crear' }}
            </button>
            @if (editing()) {
              <button type="button" class="btn-secondary" (click)="cancelEdit()">Cancelar</button>
            }
          </div>
        </form>

        <div class="lg:col-span-2">
          <ul class="grid list-none grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-4" role="list">
            @for (category of categories(); track category.id) {
              <li class="card flex items-center gap-2 px-3 py-2 transition-shadow hover:shadow-md">
                <span
                  [class]="avatarClasses(category.name)"
                  aria-hidden="true"
                >
                  {{ category.name.charAt(0).toUpperCase() }}
                </span>
                <span class="min-w-0 flex-1 truncate text-sm font-medium" [title]="category.name">
                  {{ category.name }}
                </span>
                @if (category.predefined) {
                  <span class="shrink-0 text-slate-300 dark:text-slate-600" title="Categoría predefinida">
                    <app-icon name="lock" [size]="14" />
                    <span class="sr-only">Predefinida</span>
                  </span>
                } @else {
                  <span class="flex shrink-0 gap-1">
                    <button
                      type="button"
                      class="rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-primary-600 dark:hover:bg-slate-800 dark:hover:text-primary-400"
                      (click)="startEdit(category)"
                      [attr.aria-label]="'Editar categoría ' + category.name"
                    >
                      <app-icon name="pencil" [size]="15" />
                    </button>
                    <button
                      type="button"
                      class="rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-red-600 dark:hover:bg-slate-800 dark:hover:text-red-400"
                      (click)="toDelete.set(category)"
                      [attr.aria-label]="'Eliminar categoría ' + category.name"
                    >
                      <app-icon name="trash" [size]="15" />
                    </button>
                  </span>
                }
              </li>
            }
          </ul>
        </div>
      </div>
    </section>

    <app-confirm-dialog
      [open]="toDelete() !== null"
      title="Eliminar categoría"
      [message]="'¿Seguro que quieres eliminar «' + (toDelete()?.name ?? '') + '»?'"
      (confirmed)="confirmDelete()"
      (cancelled)="toDelete.set(null)"
    />
  `
})
export class CategoriesPage {
  private readonly fb = inject(FormBuilder);
  private readonly categoryService = inject(CategoryService);
  private readonly toast = inject(ToastService);

  protected readonly categories = signal<Category[]>([]);
  protected readonly editing = signal<Category | null>(null);
  protected readonly saving = signal(false);
  protected readonly toDelete = signal<Category | null>(null);

  protected readonly form = this.fb.group({
    name: this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(100)])
  });

  constructor() {
    inject(SeoService).apply({
      title: 'Categorías — MyLibrary',
      description: 'Gestiona las categorías de tu biblioteca personal.',
      path: '/categories'
    });
    this.load();
  }

  /** Avatar compacto con color estable derivado del nombre. */
  avatarClasses(name: string): string {
    let hash = 0;
    for (const char of name) {
      hash = (hash + char.charCodeAt(0)) % AVATAR_COLORS.length;
    }
    return (
      'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white shadow-sm ' +
      AVATAR_COLORS[hash]
    );
  }

  nameInvalid(): boolean {
    const c = this.form.controls.name;
    return c.invalid && c.touched;
  }

  startEdit(category: Category): void {
    this.editing.set(category);
    this.form.patchValue({ name: category.name });
  }

  cancelEdit(): void {
    this.editing.set(null);
    this.form.reset();
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    const payload = this.form.getRawValue();
    const current = this.editing();
    const request$ = current
      ? this.categoryService.update(current.id, payload)
      : this.categoryService.create(payload);

    request$.subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success(current ? 'Categoría actualizada' : 'Categoría creada');
        this.cancelEdit();
        this.load();
      },
      error: (err) => {
        this.saving.set(false);
        this.toast.error(err?.error?.message ?? 'No se pudo guardar la categoría');
      }
    });
  }

  confirmDelete(): void {
    const category = this.toDelete();
    if (!category) {
      return;
    }
    this.categoryService.delete(category.id).subscribe({
      next: () => {
        this.toDelete.set(null);
        this.toast.success('Categoría eliminada');
        this.load();
      },
      error: (err) => {
        this.toDelete.set(null);
        this.toast.error(err?.error?.message ?? 'No se pudo eliminar la categoría');
      }
    });
  }

  private load(): void {
    this.categoryService.list().subscribe((categories) => this.categories.set(categories));
  }
}

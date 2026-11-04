import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { Category } from '../../core/models';
import { CategoryService } from '../../core/services/category.service';
import { SeoService } from '../../core/services/seo.service';
import { ToastService } from '../../core/services/toast.service';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog.component';
import { IconComponent } from '../../shared/components/icon.component';

const PALETTE = [
  '#8c6e3f', // toffee-brown
  '#5c6b3a', // dusty-olive
  '#b08040', // camel
  '#7a5e31', // saddle-brown
  '#8fa882', // dry-sage
  '#3d3222', // ebony
  '#a0522d', // sienna
  '#4a7c59', // sage-green
] as const;

type Filter = 'all' | 'custom' | 'predefined';

@Component({
  selector: 'app-categories-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, ConfirmDialogComponent, IconComponent],
  template: `
    <section aria-labelledby="categories-title">

      <!-- ── Header ── -->
      <div class="flex items-center gap-3 mb-5">
        <span
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl
                 bg-primary-100 text-primary-700
                 dark:bg-primary-900/50 dark:text-primary-300"
          aria-hidden="true"
        >
          <app-icon name="tag" [size]="20" />
        </span>
        <div>
          <h1 id="categories-title" class="text-2xl font-bold font-serif">Categorías</h1>
          <p class="text-sm text-slate-500 dark:text-slate-400">
            Organiza tu biblioteca con etiquetas propias
          </p>
        </div>
      </div>

      <!-- ── Stats pills ── -->
      <div class="flex flex-wrap gap-2 mb-5">
        <span class="stat-pill">
          <span class="stat-dot"></span>
          <span><strong>{{ categories().length }}</strong> categorías</span>
        </span>
        <span class="stat-pill">
          <span class="stat-dot"></span>
          <span><strong>{{ customCount() }}</strong> personalizadas</span>
        </span>
        <span class="stat-pill">
          <span class="stat-dot muted"></span>
          <span><strong>{{ predefinedCount() }}</strong> predefinidas</span>
        </span>
      </div>

      <!-- ── Toolbar ── -->
      <div class="mb-5 flex flex-wrap items-center gap-2">
        <!-- Search -->
        <div class="relative flex-1" style="min-width:180px; max-width:280px;">
          <span class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500">
            <app-icon name="search" [size]="15" />
          </span>
          <input
            type="text"
            class="input pl-9 h-9 text-sm"
            placeholder="Buscar categoría…"
            [value]="searchQuery()"
            (input)="searchQuery.set($any($event.target).value)"
            aria-label="Buscar categoría"
          />
        </div>
        <!-- Filters -->
        <button
          type="button"
          class="filter-btn"
          [class.active]="activeFilter() === 'all'"
          (click)="activeFilter.set('all')"
        >Todas</button>
        <button
          type="button"
          class="filter-btn"
          [class.active]="activeFilter() === 'custom'"
          (click)="activeFilter.set('custom')"
        >Personalizadas</button>
        <button
          type="button"
          class="filter-btn"
          [class.active]="activeFilter() === 'predefined'"
          (click)="activeFilter.set('predefined')"
        >Predefinidas</button>
      </div>

      <!-- ── Main grid ── -->
      <div class="grid grid-cols-1 gap-5 lg:grid-cols-[300px_1fr] items-start">

        <!-- ── Form panel ── -->
        <aside>
          <div class="card p-6 space-y-4 lg:sticky lg:top-5">
            <div class="flex items-center gap-2">
              <app-icon name="{{ editing() ? 'pencil' : 'plus' }}" [size]="16" class="text-primary-600 dark:text-primary-400" />
              <h2 class="font-semibold text-[0.9375rem]">
                {{ editing() ? 'Editar categoría' : 'Nueva categoría' }}
              </h2>
              @if (editing()) {
                <span class="ml-auto rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-wide
                             bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300">
                  Editando
                </span>
              } @else {
                <span class="ml-auto rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-wide
                             bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                  Nueva
                </span>
              }
            </div>

            <form [formGroup]="form" (ngSubmit)="submit()" novalidate class="space-y-4">

              <!-- Name field -->
              <div>
                <label class="label" for="cat-name">Nombre *</label>
                <input
                  id="cat-name"
                  type="text"
                  class="input"
                  formControlName="name"
                  placeholder="P. ej. Novela negra"
                  [attr.aria-invalid]="nameInvalid()"
                  [attr.aria-errormessage]="nameInvalid() ? 'cat-name-error' : null"
                />
                @if (nameInvalid()) {
                  <p id="cat-name-error" class="error-text" role="alert">El nombre es obligatorio</p>
                }
              </div>

              <!-- Color picker -->
              <div>
                <p class="label mb-2">Color del ícono</p>
                <div class="flex flex-wrap gap-2" role="radiogroup" aria-label="Color del ícono">
                  @for (color of PALETTE; track color) {
                    <button
                      type="button"
                      class="h-6 w-6 rounded-full ring-offset-2 transition-transform hover:scale-110"
                      [style.background]="color"
                      [class.ring-2]="selectedColor() === color"
                      [class.ring-slate-700]="selectedColor() === color"
                      [class.scale-110]="selectedColor() === color"
                      [class.dark:ring-slate-200]="selectedColor() === color"
                      [attr.aria-pressed]="selectedColor() === color"
                      [attr.aria-label]="'Color ' + color"
                      (click)="selectedColor.set(color)"
                    ></button>
                  }
                </div>
              </div>

              <!-- Live preview -->
              <div>
                <p class="label mb-2">Vista previa</p>
                <div class="flex items-center gap-3 rounded-lg border border-slate-200 dark:border-slate-700
                            bg-slate-50 dark:bg-slate-800/60 px-3 py-2">
                  <span
                    class="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px]
                           text-sm font-bold text-white shadow-sm"
                    [style.background]="selectedColor()"
                  >{{ previewInitial() }}</span>
                  <span class="text-sm font-semibold text-slate-500 dark:text-slate-400 truncate">
                    {{ form.controls.name.value?.trim() || 'Nueva categoría' }}
                  </span>
                </div>
              </div>

              <!-- Actions -->
              <div class="flex gap-2 pt-1">
                <button type="submit" class="btn-primary flex-1" [disabled]="saving()">
                  {{ saving() ? 'Guardando…' : (editing() ? 'Guardar' : 'Crear categoría') }}
                </button>
                @if (editing()) {
                  <button type="button" class="btn-secondary" (click)="cancelEdit()">
                    Cancelar
                  </button>
                }
              </div>
            </form>

            <p class="text-xs text-slate-400 dark:text-slate-500">
              Las categorías predefinidas no se pueden modificar ni eliminar.
            </p>
          </div>
        </aside>

        <!-- ── Category cards ── -->
        <div>

          <!-- Empty state -->
          @if (filteredCategories().length === 0) {
            <div class="flex flex-col items-center justify-center py-16 text-center text-slate-400 dark:text-slate-500">
              <app-icon name="tag" [size]="40" class="mb-3 opacity-30" />
              <p class="text-sm">No se encontraron categorías</p>
            </div>
          }

          <!-- Custom section -->
          @if (customFiltered().length > 0) {
            <p class="cat-section-label">Personalizadas</p>
            <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 mb-6">
              @for (category of customFiltered(); track category.id) {
                <div
                  class="card group cursor-default p-4 transition-all duration-150
                         hover:-translate-y-0.5 hover:shadow-md"
                  [attr.aria-label]="category.name"
                >
                  <div class="flex items-start justify-between gap-2 mb-3">
                    <span
                      class="flex h-10 w-10 shrink-0 items-center justify-center
                             rounded-[10px] text-[1.1rem] font-bold text-white shadow-sm
                             transition-transform group-hover:scale-105"
                      [style.background]="category.color || avatarColor(category.name)"
                    >{{ category.name.charAt(0).toUpperCase() }}</span>
                    <span class="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        type="button"
                        class="rounded-md p-1.5 text-slate-400 transition-colors
                               hover:bg-slate-100 hover:text-primary-600
                               dark:hover:bg-slate-800 dark:hover:text-primary-400"
                        (click)="startEdit(category)"
                        [attr.aria-label]="'Editar ' + category.name"
                      ><app-icon name="pencil" [size]="13" /></button>
                      <button
                        type="button"
                        class="rounded-md p-1.5 text-slate-400 transition-colors
                               hover:bg-red-50 hover:text-red-600
                               dark:hover:bg-red-900/20 dark:hover:text-red-400"
                        (click)="toDelete.set(category)"
                        [attr.aria-label]="'Eliminar ' + category.name"
                      ><app-icon name="trash" [size]="13" /></button>
                    </span>
                  </div>
                  <div
                    class="truncate font-semibold text-[0.9rem] leading-tight"
                    [title]="category.name"
                  >{{ category.name }}</div>
                  <div class="mt-1 flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500">
                    <app-icon name="book-open" [size]="11" />
                    {{ category.bookCount }}
                    {{ category.bookCount === 1 ? 'libro' : 'libros' }}
                  </div>
                </div>
              }
            </div>
          }

          <!-- Predefined section -->
          @if (predefinedFiltered().length > 0) {
            <p class="cat-section-label">Predefinidas</p>
            <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              @for (category of predefinedFiltered(); track category.id) {
                <div
                  class="card cursor-default border-dashed p-4
                         transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div class="flex items-start justify-between gap-2 mb-3">
                    <span
                      class="flex h-10 w-10 shrink-0 items-center justify-center
                             rounded-[10px] text-[1.1rem] font-bold text-white shadow-sm"
                      [style.background]="category.color || avatarColor(category.name)"
                    >{{ category.name.charAt(0).toUpperCase() }}</span>
                    <span
                      class="flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50
                             px-2 py-0.5 text-[0.6875rem] font-medium text-slate-400
                             dark:border-slate-700 dark:bg-slate-800 dark:text-slate-500"
                      title="Categoría predefinida"
                    >
                      <app-icon name="lock" [size]="10" />
                      <span class="sr-only">Predefinida</span>
                    </span>
                  </div>
                  <div
                    class="truncate font-semibold text-[0.9rem] leading-tight"
                    [title]="category.name"
                  >{{ category.name }}</div>
                  <div class="mt-1 flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500">
                    <app-icon name="book-open" [size]="11" />
                    {{ category.bookCount }}
                    {{ category.bookCount === 1 ? 'libro' : 'libros' }}
                  </div>
                </div>
              }
            </div>
          }
        </div>
      </div>
    </section>

    <app-confirm-dialog
      [open]="toDelete() !== null"
      title="Eliminar categoría"
      [message]="'¿Seguro que querés eliminar «' + (toDelete()?.name ?? '') + '»?'"
      (confirmed)="confirmDelete()"
      (cancelled)="toDelete.set(null)"
    />
  `
})
export class CategoriesPage {
  private readonly fb = inject(FormBuilder);
  private readonly categoryService = inject(CategoryService);
  private readonly toast = inject(ToastService);

  protected readonly PALETTE = PALETTE;

  protected readonly categories = signal<Category[]>([]);
  protected readonly editing = signal<Category | null>(null);
  protected readonly saving = signal(false);
  protected readonly toDelete = signal<Category | null>(null);
  protected readonly searchQuery = signal('');
  protected readonly activeFilter = signal<Filter>('all');
  protected readonly selectedColor = signal<string>(PALETTE[0]);

  protected readonly customCount = computed(() => this.categories().filter((c) => !c.predefined).length);
  protected readonly predefinedCount = computed(() => this.categories().filter((c) => c.predefined).length);

  protected readonly filteredCategories = computed(() => {
    const q = this.searchQuery().toLowerCase();
    const filter = this.activeFilter();
    return this.categories().filter((c) => {
      const matchesFilter =
        filter === 'all' ||
        (filter === 'custom' && !c.predefined) ||
        (filter === 'predefined' && c.predefined);
      return matchesFilter && (!q || c.name.toLowerCase().includes(q));
    });
  });

  protected readonly customFiltered = computed(() =>
    this.filteredCategories().filter((c) => !c.predefined)
  );
  protected readonly predefinedFiltered = computed(() =>
    this.filteredCategories().filter((c) => c.predefined)
  );

  protected readonly form = this.fb.group({
    name: this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(100)])
  });

  private readonly nameValue = toSignal(this.form.controls.name.valueChanges, {
    initialValue: this.form.controls.name.value
  });

  protected readonly previewInitial = computed(() => {
    const val = this.nameValue() ?? '';
    return val.trim() ? val.trim().charAt(0).toUpperCase() : '?';
  });

  constructor() {
    inject(SeoService).apply({
      title: 'Categorías — MyLibrary',
      description: 'Gestiona las categorías de tu biblioteca personal.',
      path: '/categories'
    });
    this.load();
  }

  protected nameInvalid(): boolean {
    const c = this.form.controls.name;
    return c.invalid && c.touched;
  }

  protected avatarColor(name: string): string {
    let hash = 0;
    for (const char of name) {
      hash = (hash + char.charCodeAt(0)) % PALETTE.length;
    }
    return PALETTE[hash];
  }

  protected startEdit(category: Category): void {
    this.editing.set(category);
    this.selectedColor.set(category.color ?? PALETTE[0]);
    this.form.patchValue({ name: category.name });
  }

  protected cancelEdit(): void {
    this.editing.set(null);
    this.selectedColor.set(PALETTE[0]);
    this.form.reset();
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    const { name } = this.form.getRawValue();
    const color = this.selectedColor();
    const current = this.editing();
    const request$ = current
      ? this.categoryService.update(current.id, { name, color })
      : this.categoryService.create({ name, color });

    request$.subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success(current ? 'Categoría actualizada' : 'Categoría creada');
        this.cancelEdit();
        this.load();
      },
      error: (err: { error?: { message?: string } }) => {
        this.saving.set(false);
        this.toast.error(err?.error?.message ?? 'No se pudo guardar la categoría');
      }
    });
  }

  protected confirmDelete(): void {
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
      error: (err: { error?: { message?: string } }) => {
        this.toDelete.set(null);
        this.toast.error(err?.error?.message ?? 'No se pudo eliminar la categoría');
      }
    });
  }

  private load(): void {
    this.categoryService.list().subscribe((categories) => this.categories.set(categories));
  }
}

import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { BookFilters, BookType, Category, Saga } from '../../core/models';

@Component({
  selector: 'app-filter-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5" role="group" aria-label="Filtros avanzados">
      <div>
        <label class="label" for="filter-category">Categoría</label>
        <select id="filter-category" class="input" (change)="onCategory($event)">
          <option value="">Todas</option>
          @for (category of categories(); track category.id) {
            <option [value]="category.id">{{ category.name }}</option>
          }
        </select>
      </div>
      <div>
        <label class="label" for="filter-type">Tipo</label>
        <select id="filter-type" class="input" (change)="onType($event)">
          <option value="">Todos</option>
          <option value="PHYSICAL">Físico</option>
          <option value="DIGITAL">Digital</option>
          <option value="AUDIOBOOK">Audiolibro</option>
        </select>
      </div>
      <div>
        <label class="label" for="filter-saga">Saga</label>
        <select id="filter-saga" class="input" (change)="onSaga($event)">
          <option value="">Todas</option>
          <option value="none">Autoconclusivos</option>
          @for (saga of sagas(); track saga.id) {
            <option [value]="saga.id">{{ saga.name }} ({{ saga.bookCount }})</option>
          }
        </select>
      </div>
      <div>
        <label class="label" for="filter-rating">Valoración</label>
        <select id="filter-rating" class="input" (change)="onRating($event)">
          <option value="" [selected]="rating() === ''">Todas</option>
          @for (stars of ratingOptions; track stars) {
            <option [value]="stars" [selected]="rating() === stars">
              {{ '★'.repeat(stars) }} · {{ stars }} {{ stars === 1 ? 'estrella' : 'estrellas' }}
            </option>
          }
        </select>
      </div>
      <div>
        <label class="label" for="filter-author">Autor</label>
        <input
          id="filter-author"
          type="text"
          class="input"
          placeholder="Filtrar por autor"
          (change)="onAuthor($event)"
        />
      </div>
    </div>
  `
})
export class FilterPanelComponent {
  readonly categories = input.required<Category[]>();
  readonly sagas = input<Saga[]>([]);
  /** Valoración ya activa al abrir el panel (p. ej. al llegar desde el panel de estadísticas). */
  readonly rating = input<number | ''>('');
  readonly filtersChange = output<Partial<BookFilters>>();

  protected readonly ratingOptions = [5, 4, 3, 2, 1];

  onRating(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.filtersChange.emit({ rating: value ? Number(value) : '' });
  }

  onSaga(event: Event): void {
    this.filtersChange.emit({ saga: (event.target as HTMLSelectElement).value });
  }

  onCategory(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.filtersChange.emit({ category: value ? Number(value) : '' });
  }

  onType(event: Event): void {
    this.filtersChange.emit({ type: (event.target as HTMLSelectElement).value as BookType | '' });
  }

  onAuthor(event: Event): void {
    this.filtersChange.emit({ author: (event.target as HTMLInputElement).value.trim() });
  }
}

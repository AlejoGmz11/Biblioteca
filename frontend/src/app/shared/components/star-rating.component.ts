import { ChangeDetectionStrategy, Component, computed, input, model, signal } from '@angular/core';

/**
 * Valoración con estrellas en pasos de media estrella (0.5 a 5).
 * Click en la mitad izquierda de una estrella = media; mitad derecha = entera.
 * Flechas del teclado ajustan en pasos de 0.5.
 */
@Component({
  selector: 'app-star-rating',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      role="radiogroup"
      [attr.aria-label]="label()"
      class="inline-flex items-center gap-1"
      (mouseleave)="hovered.set(0)"
    >
      @for (star of stars; track star) {
        <button
          type="button"
          role="radio"
          [attr.aria-checked]="rating() === star || rating() === star - 0.5"
          [attr.aria-label]="star + (star === 1 ? ' estrella' : ' estrellas') + ' (mitad izquierda: media estrella)'"
          [disabled]="readonly()"
          [tabindex]="readonly() ? -1 : 0"
          class="relative text-2xl leading-none transition-transform enabled:hover:scale-110 disabled:cursor-default"
          (click)="onStarClick(star, $event)"
          (mousemove)="onStarHover(star, $event)"
          (keydown.arrowright)="selectNext(0.5)"
          (keydown.arrowleft)="selectNext(-0.5)"
        >
          <span class="text-slate-300 dark:text-slate-600" aria-hidden="true">★</span>
          <span
            class="absolute inset-0 overflow-hidden text-camel"
            [style.width.%]="fillPercent(star)"
            aria-hidden="true"
          >★</span>
        </button>
      }
      <span class="sr-only" aria-live="polite">
        {{ rating() ? 'Valoración: ' + rating() + ' de 5' : 'Sin valoración' }}
      </span>
    </div>
  `
})
export class StarRatingComponent {
  readonly stars = [1, 2, 3, 4, 5];

  readonly rating = model<number>(0);
  readonly readonly = input(false);
  readonly label = input('Valoración');

  protected readonly hovered = signal(0);
  protected readonly displayValue = computed(() => this.hovered() || this.rating());

  /** 0, 50 o 100 según la parte de esta estrella cubierta por el valor mostrado. */
  fillPercent(star: number): number {
    const fill = Math.min(1, Math.max(0, this.displayValue() - (star - 1)));
    return fill * 100;
  }

  onStarClick(star: number, event: MouseEvent): void {
    if (this.readonly()) {
      return;
    }
    const value = this.valueFromPointer(star, event);
    // Repetir el valor actual lo borra
    this.rating.set(this.rating() === value ? 0 : value);
  }

  onStarHover(star: number, event: MouseEvent): void {
    if (this.readonly()) {
      return;
    }
    this.hovered.set(this.valueFromPointer(star, event));
  }

  selectNext(delta: number): void {
    if (this.readonly()) {
      return;
    }
    const next = Math.min(5, Math.max(0.5, (this.rating() || 0) + delta));
    this.rating.set(next);
  }

  private valueFromPointer(star: number, event: MouseEvent): number {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const isLeftHalf = event.clientX - rect.left < rect.width / 2;
    return isLeftHalf ? star - 0.5 : star;
  }
}

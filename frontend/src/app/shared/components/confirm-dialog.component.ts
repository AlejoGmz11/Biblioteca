import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  input,
  output,
  viewChild
} from '@angular/core';

@Component({
  selector: 'app-confirm-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown.escape)': 'onEscape()'
  },
  template: `
    @if (open()) {
      <div
        class="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4"
        (click)="cancelled.emit()"
      >
        <div
          role="alertdialog"
          aria-modal="true"
          [attr.aria-labelledby]="'confirm-title'"
          [attr.aria-describedby]="'confirm-message'"
          class="card w-full max-w-md p-6"
          (click)="$event.stopPropagation()"
        >
          <h2 id="confirm-title" class="text-lg font-semibold">{{ title() }}</h2>
          <p id="confirm-message" class="mt-2 text-sm text-slate-600 dark:text-slate-400">
            {{ message() }}
          </p>
          <div class="mt-6 flex justify-end gap-3">
            <button type="button" class="btn-secondary" (click)="cancelled.emit()">
              {{ cancelLabel() }}
            </button>
            <button #confirmButton type="button" class="btn-danger" (click)="confirmed.emit()">
              {{ confirmLabel() }}
            </button>
          </div>
        </div>
      </div>
    }
  `
})
export class ConfirmDialogComponent {
  readonly open = input.required<boolean>();
  readonly title = input('¿Estás seguro?');
  readonly message = input('Esta acción no se puede deshacer.');
  readonly confirmLabel = input('Eliminar');
  readonly cancelLabel = input('Cancelar');

  readonly confirmed = output<void>();
  readonly cancelled = output<void>();

  private readonly confirmButton = viewChild<ElementRef<HTMLButtonElement>>('confirmButton');

  constructor() {
    // Move focus into the dialog when it opens (WCAG focus management)
    effect(() => {
      if (this.open()) {
        setTimeout(() => this.confirmButton()?.nativeElement.focus());
      }
    });
  }

  onEscape(): void {
    if (this.open()) {
      this.cancelled.emit();
    }
  }
}

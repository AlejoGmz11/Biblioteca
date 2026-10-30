import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { SeoService } from '../../core/services/seo.service';
import { ToastService } from '../../core/services/toast.service';

function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const password = group.get('password')?.value;
  const confirm = group.get('confirm')?.value;
  return !confirm || password === confirm ? null : { mismatch: true };
}

/** Página a la que llega el enlace del email: /reset-password?token=… */
@Component({
  selector: 'app-reset-password-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="fixed inset-0 -z-10" aria-hidden="true">
      <img src="/images/bg-auth.jpg" alt="" class="h-full w-full object-cover" />
      <div class="absolute inset-0 bg-gradient-to-b from-charcoal-brown/80 via-dark-walnut/70 to-charcoal-brown/90"></div>
    </div>

    <section class="mx-auto mt-12 max-w-md" aria-labelledby="reset-title">
      <div class="mb-6 text-center">
        <p class="text-xs font-semibold uppercase tracking-[0.25em] text-dry-sage">Recuperar acceso</p>
        <h1 id="reset-title" class="mt-2 text-3xl font-bold text-white drop-shadow-md sm:text-4xl">
          Nueva contraseña
        </h1>
      </div>

      <div class="card bg-white/95 p-8 dark:bg-slate-900/95">
        @if (!hasToken()) {
          <div role="alert">
            <p class="font-medium">Este enlace no es válido</p>
            <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Falta el código de recuperación. Abre el enlace del correo o solicita uno nuevo.
            </p>
            <a routerLink="/forgot-password" class="btn-primary mt-6">Solicitar otro enlace</a>
          </div>
        } @else {
          <p class="text-sm text-slate-500 dark:text-slate-400">Elige tu nueva contraseña.</p>
          <form [formGroup]="form" (ngSubmit)="submit()" class="mt-6 space-y-4" novalidate>
            <div>
              <label class="label" for="reset-password">Nueva contraseña</label>
              <input
                id="reset-password"
                type="password"
                class="input"
                formControlName="password"
                autocomplete="new-password"
                aria-describedby="reset-password-hint"
                [attr.aria-invalid]="isInvalid('password')"
                [attr.aria-errormessage]="isInvalid('password') ? 'reset-password-error' : null"
              />
              <p id="reset-password-hint" class="mt-1 text-xs text-slate-400">Mínimo 8 caracteres</p>
              @if (isInvalid('password')) {
                <p id="reset-password-error" class="error-text" role="alert">
                  La contraseña debe tener al menos 8 caracteres
                </p>
              }
            </div>
            <div>
              <label class="label" for="reset-confirm">Repite la contraseña</label>
              <input
                id="reset-confirm"
                type="password"
                class="input"
                formControlName="confirm"
                autocomplete="new-password"
                [attr.aria-invalid]="showMismatch()"
                [attr.aria-errormessage]="showMismatch() ? 'reset-confirm-error' : null"
              />
              @if (showMismatch()) {
                <p id="reset-confirm-error" class="error-text" role="alert">Las contraseñas no coinciden</p>
              }
            </div>
            <button type="submit" class="btn-primary w-full" [disabled]="loading()">
              {{ loading() ? 'Guardando…' : 'Guardar contraseña' }}
            </button>
          </form>
        }
      </div>
    </section>
  `
})
export class ResetPasswordPage {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  /** Query param `token`, enlazado por withComponentInputBinding. */
  readonly token = input<string>();

  protected readonly hasToken = computed(() => !!this.token()?.trim());
  protected readonly loading = signal(false);

  protected readonly form = this.fb.nonNullable.group(
    {
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirm: ['', Validators.required]
    },
    { validators: passwordsMatch }
  );

  constructor() {
    inject(SeoService).apply({ title: 'Nueva contraseña — MyLibrary', path: '/reset-password' });
  }

  isInvalid(control: 'password'): boolean {
    const c = this.form.controls[control];
    return c.invalid && c.touched;
  }

  showMismatch(): boolean {
    return this.form.hasError('mismatch') && this.form.controls.confirm.touched;
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    this.auth.resetPassword(this.token()!, this.form.getRawValue().password).subscribe({
      next: () => {
        this.loading.set(false);
        this.toast.success('Contraseña restablecida. Ya puedes iniciar sesión');
        void this.router.navigate(['/login']);
      },
      error: (err) => {
        this.loading.set(false);
        this.toast.error(err?.error?.message ?? 'No se pudo restablecer la contraseña');
      }
    });
  }
}

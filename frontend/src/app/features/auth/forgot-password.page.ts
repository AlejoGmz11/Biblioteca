import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { SeoService } from '../../core/services/seo.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-forgot-password-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="fixed inset-0 -z-10" aria-hidden="true">
      <img src="/images/bg-auth.jpg" alt="" class="h-full w-full object-cover" />
      <div class="absolute inset-0 bg-gradient-to-b from-charcoal-brown/80 via-dark-walnut/70 to-charcoal-brown/90"></div>
    </div>

    <section class="mx-auto mt-12 max-w-md" aria-labelledby="forgot-title">
      <div class="mb-6 text-center">
        <p class="text-xs font-semibold uppercase tracking-[0.25em] text-dry-sage">Recuperar acceso</p>
        <h1 id="forgot-title" class="mt-2 text-3xl font-bold text-white drop-shadow-md sm:text-4xl">
          ¿Olvidaste tu contraseña?
        </h1>
      </div>

      <div class="card bg-white/95 p-8 dark:bg-slate-900/95">
        @if (sent()) {
          <div role="status" aria-live="polite">
            <h2 class="text-lg font-semibold">Revisa tu correo</h2>
            <p class="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Si <strong>{{ form.controls.email.value }}</strong> está registrado, te hemos enviado un
              enlace para elegir una contraseña nueva. Caduca en 30 minutos.
            </p>
            <p class="mt-2 text-xs text-slate-400">
              ¿No llega? Mira en la carpeta de spam o vuelve a solicitarlo.
            </p>
            <div class="mt-6 flex gap-3">
              <button type="button" class="btn-secondary" (click)="sent.set(false)">Reenviar</button>
              <a routerLink="/login" class="btn-primary">Volver al inicio de sesión</a>
            </div>
          </div>
        } @else {
          <p class="text-sm text-slate-500 dark:text-slate-400">
            Escribe el email de tu cuenta y te enviaremos un enlace para restablecerla.
          </p>
          <form [formGroup]="form" (ngSubmit)="submit()" class="mt-6 space-y-4" novalidate>
            <div>
              <label class="label" for="forgot-email">Email</label>
              <input
                id="forgot-email"
                type="email"
                class="input"
                formControlName="email"
                autocomplete="email"
                [attr.aria-invalid]="isInvalid()"
                [attr.aria-errormessage]="isInvalid() ? 'forgot-email-error' : null"
              />
              @if (isInvalid()) {
                <p id="forgot-email-error" class="error-text" role="alert">Introduce un email válido</p>
              }
            </div>
            <button type="submit" class="btn-primary w-full" [disabled]="loading()">
              {{ loading() ? 'Enviando…' : 'Enviarme el enlace' }}
            </button>
          </form>
          <p class="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
            <a routerLink="/login" class="font-medium text-primary-600 hover:underline dark:text-primary-400">
              Volver al inicio de sesión
            </a>
          </p>
        }
      </div>
    </section>
  `
})
export class ForgotPasswordPage {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  protected readonly loading = signal(false);
  protected readonly sent = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]]
  });

  constructor() {
    inject(SeoService).apply({
      title: 'Recuperar contraseña — MyLibrary',
      description: 'Solicita un enlace para restablecer la contraseña de tu cuenta de MyLibrary.',
      path: '/forgot-password'
    });
  }

  isInvalid(): boolean {
    const c = this.form.controls.email;
    return c.invalid && c.touched;
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    this.auth.forgotPassword(this.form.getRawValue().email).subscribe({
      next: () => {
        this.loading.set(false);
        this.sent.set(true);
      },
      error: (err) => {
        this.loading.set(false);
        this.toast.error(err?.error?.message ?? 'No se pudo enviar el correo. Inténtalo de nuevo');
      }
    });
  }
}

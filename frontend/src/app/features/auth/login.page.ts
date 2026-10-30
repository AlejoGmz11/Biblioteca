import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { SeoService } from '../../core/services/seo.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-login-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <!-- Fondo de biblioteca a pantalla completa -->
    <div class="fixed inset-0 -z-10" aria-hidden="true">
      <img src="/images/bg-auth.jpg" alt="" class="h-full w-full object-cover" />
      <div
        class="absolute inset-0 bg-gradient-to-b from-charcoal-brown/80 via-dark-walnut/70 to-charcoal-brown/90"
      ></div>
    </div>

    <section class="mx-auto mt-12 max-w-md" aria-labelledby="login-title">
      <div class="mb-6 text-center">
        <p class="text-xs font-semibold uppercase tracking-[0.25em] text-dry-sage">
          Bienvenido de nuevo
        </p>
        <h1 id="login-title" class="mt-2 text-3xl font-bold text-white drop-shadow-md sm:text-4xl">
          Inicia sesión
        </h1>
      </div>

      <div class="card bg-white/95 p-8 dark:bg-slate-900/95">
        <p class="text-sm text-slate-500 dark:text-slate-400">
          Accede a tu biblioteca personal
        </p>

        <form [formGroup]="form" (ngSubmit)="submit()" class="mt-6 space-y-4" novalidate>
          <div>
            <label class="label" for="username">Nombre de usuario</label>
            <input
              id="username"
              type="text"
              class="input"
              formControlName="username"
              autocomplete="username"
              [attr.aria-invalid]="isInvalid('username')"
              [attr.aria-errormessage]="isInvalid('username') ? 'username-error' : null"
            />
            @if (isInvalid('username')) {
              <p id="username-error" class="error-text" role="alert">El nombre de usuario es obligatorio</p>
            }
          </div>

          <div>
            <label class="label" for="password">Contraseña</label>
            <input
              id="password"
              type="password"
              class="input"
              formControlName="password"
              autocomplete="current-password"
              [attr.aria-invalid]="isInvalid('password')"
              [attr.aria-errormessage]="isInvalid('password') ? 'password-error' : null"
            />
            @if (isInvalid('password')) {
              <p id="password-error" class="error-text" role="alert">La contraseña es obligatoria</p>
            }
            <p class="mt-1 text-right text-sm">
              <a routerLink="/forgot-password" class="text-primary-600 hover:underline dark:text-primary-400">
                ¿Olvidaste tu contraseña?
              </a>
            </p>
          </div>

          <button type="submit" class="btn-primary w-full" [disabled]="loading()">
            {{ loading() ? 'Entrando…' : 'Entrar' }}
          </button>
        </form>

        <p class="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
          ¿No tienes cuenta?
          <a routerLink="/register" class="font-medium text-primary-600 hover:underline dark:text-primary-400">
            Regístrate
          </a>
        </p>
      </div>
    </section>
  `
})
export class LoginPage {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  protected readonly loading = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    username: ['', Validators.required],
    password: ['', Validators.required]
  });

  constructor() {
    inject(SeoService).apply({
      title: 'Iniciar sesión — MyLibrary',
      description: 'Accede a tu biblioteca personal en MyLibrary.',
      path: '/login'
    });
  }

  isInvalid(control: 'username' | 'password'): boolean {
    const c = this.form.controls[control];
    return c.invalid && c.touched;
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    this.auth.login(this.form.getRawValue()).subscribe({
      next: () => {
        this.loading.set(false);
        void this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.loading.set(false);
        this.toast.error(err?.error?.message ?? 'No se pudo iniciar sesión');
      }
    });
  }
}

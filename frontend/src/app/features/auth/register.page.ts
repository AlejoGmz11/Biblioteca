import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { SeoService } from '../../core/services/seo.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-register-page',
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

    <section class="mx-auto mt-12 max-w-md" aria-labelledby="register-title">
      <div class="mb-6 text-center">
        <p class="text-xs font-semibold uppercase tracking-[0.25em] text-dry-sage">
          Únete a MyLibrary
        </p>
        <h1 id="register-title" class="mt-2 text-3xl font-bold text-white drop-shadow-md sm:text-4xl">
          Crea tu cuenta
        </h1>
      </div>

      <div class="card bg-white/95 p-8 dark:bg-slate-900/95">
        <p class="text-sm text-slate-500 dark:text-slate-400">
          Empieza a organizar tus lecturas
        </p>

        <form [formGroup]="form" (ngSubmit)="submit()" class="mt-6 space-y-4" novalidate>
          <div>
            <label class="label" for="reg-username">Nombre de usuario</label>
            <input
              id="reg-username"
              type="text"
              class="input"
              formControlName="username"
              autocomplete="username"
              [attr.aria-invalid]="isInvalid('username')"
              [attr.aria-errormessage]="isInvalid('username') ? 'reg-username-error' : null"
            />
            @if (isInvalid('username')) {
              <p id="reg-username-error" class="error-text" role="alert">
                Introduce un nombre de usuario de al menos 3 caracteres
              </p>
            }
          </div>

          <div>
            <label class="label" for="reg-email">Email</label>
            <input
              id="reg-email"
              type="email"
              class="input"
              formControlName="email"
              autocomplete="email"
              [attr.aria-invalid]="isInvalid('email')"
              [attr.aria-errormessage]="isInvalid('email') ? 'reg-email-error' : null"
            />
            @if (isInvalid('email')) {
              <p id="reg-email-error" class="error-text" role="alert">Introduce un email válido</p>
            }
          </div>

          <div>
            <label class="label" for="reg-password">Contraseña</label>
            <input
              id="reg-password"
              type="password"
              class="input"
              formControlName="password"
              autocomplete="new-password"
              aria-describedby="password-hint"
              [attr.aria-invalid]="isInvalid('password')"
              [attr.aria-errormessage]="isInvalid('password') ? 'reg-password-error' : null"
            />
            <p id="password-hint" class="mt-1 text-xs text-slate-400">Mínimo 8 caracteres</p>
            @if (isInvalid('password')) {
              <p id="reg-password-error" class="error-text" role="alert">
                La contraseña debe tener al menos 8 caracteres
              </p>
            }
          </div>

          <button type="submit" class="btn-primary w-full" [disabled]="loading()">
            {{ loading() ? 'Creando cuenta…' : 'Crear cuenta' }}
          </button>
        </form>

        <p class="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
          ¿Ya tienes cuenta?
          <a routerLink="/login" class="font-medium text-primary-600 hover:underline dark:text-primary-400">
            Inicia sesión
          </a>
        </p>
      </div>
    </section>
  `
})
export class RegisterPage {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  protected readonly loading = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    username: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(50)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]]
  });

  constructor() {
    inject(SeoService).apply({
      title: 'Crear cuenta — MyLibrary',
      description: 'Crea tu cuenta gratuita en MyLibrary y organiza tu biblioteca personal.',
      path: '/register'
    });
  }

  isInvalid(control: 'username' | 'email' | 'password'): boolean {
    const c = this.form.controls[control];
    return c.invalid && c.touched;
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    this.auth.register(this.form.getRawValue()).subscribe({
      next: () => {
        this.loading.set(false);
        this.toast.success('¡Cuenta creada! Bienvenido a MyLibrary');
        void this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.loading.set(false);
        this.toast.error(err?.error?.message ?? 'No se pudo crear la cuenta');
      }
    });
  }
}

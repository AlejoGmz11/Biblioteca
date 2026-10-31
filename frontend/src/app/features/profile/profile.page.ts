import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators
} from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { ProfileService } from '../../core/services/profile.service';
import { SeoService } from '../../core/services/seo.service';
import { ToastService } from '../../core/services/toast.service';
import { IconComponent } from '../../shared/components/icon.component';

/** Comprueba que la nueva contraseña y su confirmación coincidan. */
function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const newPassword = group.get('newPassword')?.value;
  const confirm = group.get('confirmPassword')?.value;
  return !confirm || newPassword === confirm ? null : { mismatch: true };
}

@Component({
  selector: 'app-profile-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, ReactiveFormsModule, IconComponent],
  template: `
    <section class="mx-auto max-w-xl" aria-labelledby="profile-title">
      <h1 id="profile-title" class="text-2xl font-bold">Mi perfil</h1>

      @if (auth.user(); as user) {
        <div class="card mt-6 p-6">
          <div class="flex items-center gap-4">
            @if (user.avatarUrl) {
              <img
                [src]="user.avatarUrl"
                [alt]="'Avatar de ' + user.username"
                class="h-16 w-16 rounded-full object-cover"
              />
            } @else {
              <div
                class="flex h-16 w-16 items-center justify-center rounded-full bg-primary-100 text-2xl font-bold text-primary-700 dark:bg-primary-900 dark:text-primary-300"
                aria-hidden="true"
              >
                {{ user.username.charAt(0).toUpperCase() }}
              </div>
            }
            <div>
              <p class="text-lg font-semibold">{{ user.username }}</p>
              <p class="text-sm text-slate-500 dark:text-slate-400">
                Miembro desde {{ user.createdAt | date: 'MMMM yyyy' }}
              </p>
            </div>
          </div>

          <form [formGroup]="form" (ngSubmit)="submit()" class="mt-6 space-y-4" novalidate>
            <div>
              <label class="label" for="profile-username">Nombre de usuario</label>
              <input id="profile-username" type="text" class="input" formControlName="username" autocomplete="username" />
            </div>
            <div>
              <label class="label" for="profile-email">Email</label>
              <input id="profile-email" type="email" class="input" formControlName="email" autocomplete="email" />
            </div>
            <div>
              <label class="label" for="profile-avatar">URL del avatar</label>
              <input id="profile-avatar" type="url" class="input" formControlName="avatarUrl" placeholder="https://…" />
            </div>
            <div>
              <label class="label" for="reading-goal">Meta de lectura anual</label>
              <input
                id="reading-goal"
                type="number"
                class="input"
                formControlName="readingGoal"
                min="1"
                max="365"
                placeholder="Ej: 24 libros por año"
              />
              <p class="mt-1 text-xs text-slate-400">Cuántos libros querés terminar este año. Se muestra en el panel.</p>
            </div>
            <button type="submit" class="btn-primary" [disabled]="saving() || form.invalid">
              {{ saving() ? 'Guardando…' : 'Guardar cambios' }}
            </button>
          </form>
        </div>

        <!-- Cambio de contraseña -->
        <div class="card mt-6 p-6">
          <h2 class="flex items-center gap-2 text-lg font-semibold">
            <span class="text-primary-600 dark:text-primary-400" aria-hidden="true">
              <app-icon name="lock" [size]="18" />
            </span>
            Cambiar contraseña
          </h2>
          <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Necesitas tu contraseña actual para poder cambiarla.
          </p>

          <form
            [formGroup]="passwordForm"
            (ngSubmit)="changePassword()"
            class="mt-4 space-y-4"
            novalidate
          >
            <div>
              <label class="label" for="current-password">Contraseña actual</label>
              <input
                id="current-password"
                type="password"
                class="input"
                formControlName="currentPassword"
                autocomplete="current-password"
                [attr.aria-invalid]="isInvalid('currentPassword')"
                [attr.aria-errormessage]="isInvalid('currentPassword') ? 'current-password-error' : null"
              />
              @if (isInvalid('currentPassword')) {
                <p id="current-password-error" class="error-text" role="alert">
                  Introduce tu contraseña actual
                </p>
              }
            </div>

            <div>
              <label class="label" for="new-password">Nueva contraseña</label>
              <input
                id="new-password"
                type="password"
                class="input"
                formControlName="newPassword"
                autocomplete="new-password"
                aria-describedby="new-password-hint"
                [attr.aria-invalid]="isInvalid('newPassword')"
                [attr.aria-errormessage]="isInvalid('newPassword') ? 'new-password-error' : null"
              />
              <p id="new-password-hint" class="mt-1 text-xs text-slate-400">Mínimo 8 caracteres</p>
              @if (isInvalid('newPassword')) {
                <p id="new-password-error" class="error-text" role="alert">
                  La nueva contraseña debe tener al menos 8 caracteres
                </p>
              }
            </div>

            <div>
              <label class="label" for="confirm-password">Repite la nueva contraseña</label>
              <input
                id="confirm-password"
                type="password"
                class="input"
                formControlName="confirmPassword"
                autocomplete="new-password"
                [attr.aria-invalid]="showMismatch()"
                [attr.aria-errormessage]="showMismatch() ? 'confirm-password-error' : null"
              />
              @if (showMismatch()) {
                <p id="confirm-password-error" class="error-text" role="alert">
                  Las contraseñas no coinciden
                </p>
              }
            </div>

            <button type="submit" class="btn-primary" [disabled]="changingPassword()">
              {{ changingPassword() ? 'Cambiando…' : 'Cambiar contraseña' }}
            </button>
          </form>
        </div>
      }
    </section>
  `
})
export class ProfilePage {
  private readonly fb = inject(FormBuilder);
  private readonly profileService = inject(ProfileService);
  private readonly toast = inject(ToastService);

  protected readonly auth = inject(AuthService);
  protected readonly saving = signal(false);
  protected readonly changingPassword = signal(false);

  protected readonly form = this.fb.group({
    username: this.fb.nonNullable.control('', [Validators.required, Validators.minLength(3)]),
    email: this.fb.nonNullable.control('', [Validators.required, Validators.email]),
    avatarUrl: this.fb.control<string | null>(null),
    readingGoal: this.fb.control<number | null>(null, [Validators.min(1), Validators.max(365)])
  });

  protected readonly passwordForm = this.fb.nonNullable.group(
    {
      currentPassword: ['', Validators.required],
      newPassword: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', Validators.required]
    },
    { validators: passwordsMatch }
  );

  constructor() {
    inject(SeoService).apply({ title: 'Perfil — MyLibrary', path: '/profile' });
    const user = this.auth.user();
    if (user) {
      this.form.patchValue({
        username: user.username,
        email: user.email,
        avatarUrl: user.avatarUrl,
        readingGoal: user.readingGoal ?? null
      });
    }
  }

  isInvalid(control: 'currentPassword' | 'newPassword'): boolean {
    const c = this.passwordForm.controls[control];
    return c.invalid && c.touched;
  }

  showMismatch(): boolean {
    return (
      this.passwordForm.hasError('mismatch') && this.passwordForm.controls.confirmPassword.touched
    );
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.profileService.update(this.form.getRawValue()).subscribe({
      next: (user) => {
        this.saving.set(false);
        this.auth.updateStoredUser(user);
        this.toast.success('Perfil actualizado');
      },
      error: (err) => {
        this.saving.set(false);
        this.toast.error(err?.error?.message ?? 'No se pudo actualizar el perfil');
      }
    });
  }

  changePassword(): void {
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }
    this.changingPassword.set(true);
    const { currentPassword, newPassword } = this.passwordForm.getRawValue();
    this.profileService.changePassword({ currentPassword, newPassword }).subscribe({
      next: () => {
        this.changingPassword.set(false);
        this.passwordForm.reset();
        this.toast.success('Contraseña actualizada');
      },
      error: (err) => {
        this.changingPassword.set(false);
        this.toast.error(err?.error?.message ?? 'No se pudo cambiar la contraseña');
      }
    });
  }
}

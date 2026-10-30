import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from './core/services/auth.service';
import { SessionTimeoutService } from './core/services/session-timeout.service';
import { ThemeService } from './core/services/theme.service';
import { NavbarComponent } from './shared/components/navbar.component';
import { ToastContainerComponent } from './shared/components/toast-container.component';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, NavbarComponent, ToastContainerComponent],
  template: `
    <!-- Fondo global de biblioteca: foto con un velo del color de la paleta
         para mantener la legibilidad (claro: crema salvia, oscuro: carbón) -->
    <div class="fixed inset-0 -z-10" aria-hidden="true">
      <img src="/images/bg-library.jpg" alt="" class="h-full w-full object-cover" />
      <div class="absolute inset-0 bg-slate-50/95 dark:bg-slate-950/[0.97]"></div>
    </div>

    <a href="#main-content" class="skip-link">Saltar al contenido principal</a>

    @if (auth.isLoggedIn()) {
      <app-navbar />
    }

    <main id="main-content" role="main" class="mx-auto min-h-screen w-full max-w-7xl px-4 py-6" tabindex="-1">
      <router-outlet />
    </main>

    <footer role="contentinfo" class="border-t border-slate-200 py-6 text-center text-sm text-slate-400 dark:border-slate-800">
      <p>MyLibrary — tu biblioteca personal</p>
    </footer>

    <app-toast-container />
  `
})
export class App {
  protected readonly auth = inject(AuthService);

  constructor() {
    // Instantiate the theme service early so the persisted theme is applied
    inject(ThemeService);
    // Auto-logout tras 30 minutos de inactividad
    inject(SessionTimeoutService);
  }
}

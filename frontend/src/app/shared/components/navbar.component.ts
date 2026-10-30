import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { DarkModeToggleComponent } from './dark-mode-toggle.component';
import { IconComponent } from './icon.component';
import { ClickOutsideDirective } from '../directives/click-outside.directive';

@Component({
  selector: 'app-navbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, DarkModeToggleComponent, ClickOutsideDirective, IconComponent],
  template: `
    <header role="banner" class="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
      <div class="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
        <a routerLink="/dashboard" class="flex items-center gap-2 text-lg font-bold" aria-label="MyLibrary, ir al panel">
          <span class="text-primary-600 dark:text-primary-400" aria-hidden="true">
            <app-icon name="book-open" [size]="24" [strokeWidth]="2" />
          </span>
          MyLibrary
        </a>

        <nav role="navigation" aria-label="Navegación principal" class="hidden items-center gap-1 md:flex">
          @for (item of navItems; track item.path) {
            <a
              [routerLink]="item.path"
              routerLinkActive="bg-slate-100 dark:bg-slate-800 text-primary-700 dark:text-primary-300"
              class="rounded-lg px-3 py-2 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              {{ item.label }}
            </a>
          }
        </nav>

        <div class="flex items-center gap-2">
          <app-dark-mode-toggle />

          <div class="relative" (appClickOutside)="menuOpen.set(false)">
            <button
              type="button"
              class="btn-secondary"
              [attr.aria-expanded]="menuOpen()"
              aria-haspopup="menu"
              aria-controls="user-menu"
              (click)="toggleMenu()"
              (keydown.escape)="menuOpen.set(false)"
            >
              <span class="max-w-32 truncate">{{ auth.user()?.username }}</span>
              <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                <path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd" />
              </svg>
            </button>
            @if (menuOpen()) {
              <div
                id="user-menu"
                role="menu"
                class="card absolute right-0 mt-2 w-48 overflow-hidden py-1 shadow-lg"
              >
                <a
                  role="menuitem"
                  routerLink="/profile"
                  class="block px-4 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                  (click)="menuOpen.set(false)"
                >
                  Mi perfil
                </a>
                <a
                  role="menuitem"
                  routerLink="/export"
                  class="block px-4 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                  (click)="menuOpen.set(false)"
                >
                  Exportar datos
                </a>
                <button
                  role="menuitem"
                  type="button"
                  class="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-slate-100 dark:text-red-400 dark:hover:bg-slate-800"
                  (click)="auth.logout()"
                >
                  Cerrar sesión
                </button>
              </div>
            }
          </div>

          <button
            type="button"
            class="btn-secondary !p-2 md:hidden"
            [attr.aria-expanded]="mobileOpen()"
            aria-controls="mobile-nav"
            aria-label="Abrir menú de navegación"
            (click)="toggleMobile()"
          >
            <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>
        </div>
      </div>

      @if (mobileOpen()) {
        <nav id="mobile-nav" role="navigation" aria-label="Navegación móvil" class="border-t border-slate-200 px-4 py-2 dark:border-slate-800 md:hidden">
          @for (item of navItems; track item.path) {
            <a
              [routerLink]="item.path"
              routerLinkActive="text-primary-700 dark:text-primary-300"
              class="block rounded-lg px-3 py-2 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
              (click)="mobileOpen.set(false)"
            >
              {{ item.label }}
            </a>
          }
        </nav>
      }
    </header>
  `
})
export class NavbarComponent {
  protected readonly auth = inject(AuthService);

  protected readonly menuOpen = signal(false);
  protected readonly mobileOpen = signal(false);

  protected readonly navItems = [
    { path: '/dashboard', label: 'Panel' },
    { path: '/books', label: 'Mis libros' },
    { path: '/categories', label: 'Categorías' }
  ];

  toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  toggleMobile(): void {
    this.mobileOpen.update((open) => !open);
  }
}

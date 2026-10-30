import { DOCUMENT } from '@angular/common';
import { Injectable, PLATFORM_ID, effect, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

const THEME_KEY = 'mylibrary-theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly darkMode = signal<boolean>(this.initialTheme());

  constructor() {
    effect(() => {
      const dark = this.darkMode();
      this.document.documentElement.classList.toggle('dark', dark);
      if (this.isBrowser) {
        localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light');
      }
    });
  }

  toggle(): void {
    this.darkMode.update((dark) => !dark);
  }

  private initialTheme(): boolean {
    if (!this.isBrowser) {
      return false;
    }
    const stored = localStorage.getItem(THEME_KEY);
    if (stored) {
      return stored === 'dark';
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
}

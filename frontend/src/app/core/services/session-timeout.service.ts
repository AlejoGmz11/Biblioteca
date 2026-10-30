import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Injectable, NgZone, PLATFORM_ID, effect, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';
import { ToastService } from './toast.service';

const ACTIVITY_EVENTS = ['click', 'keydown', 'scroll', 'mousemove', 'touchstart'] as const;
const CHECK_INTERVAL_MS = 30_000;

/**
 * Cierra la sesión automáticamente tras un periodo de inactividad
 * (environment.sessionTimeoutMinutes). Cualquier interacción del usuario
 * reinicia la cuenta atrás.
 */
@Injectable({ providedIn: 'root' })
export class SessionTimeoutService {
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly zone = inject(NgZone);
  private readonly document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly timeoutMs = environment.sessionTimeoutMinutes * 60 * 1000;
  private lastActivity = Date.now();
  private intervalId: ReturnType<typeof setInterval> | null = null;

  constructor() {
    if (!this.isBrowser) {
      return;
    }
    // Fuera de Angular: mousemove/scroll no deben disparar change detection
    this.zone.runOutsideAngular(() => {
      for (const event of ACTIVITY_EVENTS) {
        this.document.addEventListener(event, () => (this.lastActivity = Date.now()), {
          passive: true
        });
      }
    });
    effect(() => {
      if (this.auth.isLoggedIn()) {
        this.start();
      } else {
        this.stop();
      }
    });
  }

  private start(): void {
    this.lastActivity = Date.now();
    if (this.intervalId !== null) {
      return;
    }
    this.zone.runOutsideAngular(() => {
      this.intervalId = setInterval(() => {
        if (Date.now() - this.lastActivity >= this.timeoutMs) {
          this.zone.run(() => {
            this.stop();
            this.toast.info('Tu sesión se ha cerrado por inactividad');
            this.auth.logout();
          });
        }
      }, CHECK_INTERVAL_MS);
    });
  }

  private stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}

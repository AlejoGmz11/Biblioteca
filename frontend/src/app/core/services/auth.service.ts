import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse, AuthResponse, User } from '../models';

const ACCESS_KEY = 'mylibrary-access-token';
const REFRESH_KEY = 'mylibrary-refresh-token';
const USER_KEY = 'mylibrary-user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly currentUser = signal<User | null>(this.restoreUser());

  readonly user = this.currentUser.asReadonly();
  readonly isLoggedIn = computed(() => this.currentUser() !== null);

  register(payload: { username: string; email: string; password: string }): Observable<ApiResponse<AuthResponse>> {
    return this.http
      .post<ApiResponse<AuthResponse>>(`${environment.apiUrl}/auth/register`, payload)
      .pipe(tap((res) => this.storeSession(res.data)));
  }

  login(payload: { username: string; password: string }): Observable<ApiResponse<AuthResponse>> {
    return this.http
      .post<ApiResponse<AuthResponse>>(`${environment.apiUrl}/auth/login`, payload)
      .pipe(tap((res) => this.storeSession(res.data)));
  }

  refresh(): Observable<ApiResponse<AuthResponse>> {
    return this.http
      .post<ApiResponse<AuthResponse>>(`${environment.apiUrl}/auth/refresh`, {
        refreshToken: this.refreshToken
      })
      .pipe(tap((res) => this.storeSession(res.data)));
  }

  /** Pide el enlace de recuperación; el backend responde igual exista o no el email. */
  forgotPassword(email: string): Observable<ApiResponse<void>> {
    return this.http.post<ApiResponse<void>>(`${environment.apiUrl}/auth/forgot-password`, { email });
  }

  resetPassword(token: string, newPassword: string): Observable<ApiResponse<void>> {
    return this.http.post<ApiResponse<void>>(`${environment.apiUrl}/auth/reset-password`, {
      token,
      newPassword
    });
  }

  logout(): void {
    if (this.isBrowser) {
      localStorage.removeItem(ACCESS_KEY);
      localStorage.removeItem(REFRESH_KEY);
      localStorage.removeItem(USER_KEY);
    }
    this.currentUser.set(null);
    void this.router.navigate(['/login']);
  }

  updateStoredUser(user: User): void {
    this.currentUser.set(user);
    if (this.isBrowser) {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    }
  }

  get accessToken(): string | null {
    return this.isBrowser ? localStorage.getItem(ACCESS_KEY) : null;
  }

  get refreshToken(): string | null {
    return this.isBrowser ? localStorage.getItem(REFRESH_KEY) : null;
  }

  private storeSession(auth: AuthResponse): void {
    this.currentUser.set(auth.user);
    if (this.isBrowser) {
      localStorage.setItem(ACCESS_KEY, auth.accessToken);
      localStorage.setItem(REFRESH_KEY, auth.refreshToken);
      localStorage.setItem(USER_KEY, JSON.stringify(auth.user));
    }
  }

  private restoreUser(): User | null {
    if (!this.isBrowser) {
      return null;
    }
    const raw = localStorage.getItem(USER_KEY);
    if (!raw || !localStorage.getItem(ACCESS_KEY)) {
      return null;
    }
    try {
      return JSON.parse(raw) as User;
    } catch {
      return null;
    }
  }
}

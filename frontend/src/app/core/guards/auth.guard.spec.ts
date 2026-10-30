import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';
import { signal } from '@angular/core';
import { authGuard, guestGuard } from './auth.guard';
import { AuthService } from '../services/auth.service';

describe('auth guards', () => {
  const loggedIn = signal(false);

  beforeEach(() => {
    loggedIn.set(false);
    TestBed.configureTestingModule({
      providers: [{ provide: AuthService, useValue: { isLoggedIn: loggedIn } }]
    });
  });

  function run(guard: typeof authGuard) {
    return TestBed.runInInjectionContext(() => guard({} as never, {} as never));
  }

  it('authGuard redirects anonymous users to /login (protects the reader route)', () => {
    const result = run(authGuard);
    expect(result instanceof UrlTree).toBeTrue();
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/login');
  });

  it('authGuard allows logged-in users', () => {
    loggedIn.set(true);
    expect(run(authGuard)).toBeTrue();
  });

  it('guestGuard sends logged-in users to the dashboard', () => {
    loggedIn.set(true);
    const result = run(guestGuard);
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/dashboard');
  });
});

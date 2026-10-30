import { TestBed, fakeAsync, flush, tick } from '@angular/core/testing';
import { WritableSignal, signal } from '@angular/core';
import { SessionTimeoutService } from './session-timeout.service';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';

const TIMEOUT_MS = environment.sessionTimeoutMinutes * 60 * 1000;
const CHECK_MS = 30_000;

describe('SessionTimeoutService', () => {
  let loggedIn: WritableSignal<boolean>;
  let logoutSpy: jasmine.Spy;

  beforeEach(() => {
    loggedIn = signal(true);
    logoutSpy = jasmine.createSpy('logout').and.callFake(() => loggedIn.set(false));
    TestBed.configureTestingModule({
      providers: [
        {
          provide: AuthService,
          useValue: { isLoggedIn: loggedIn, logout: logoutSpy }
        }
      ]
    });
  });

  it('logs out after the inactivity timeout', fakeAsync(() => {
    TestBed.inject(SessionTimeoutService);
    tick(0); // flush the effect that arms the watcher

    tick(TIMEOUT_MS + CHECK_MS);

    expect(logoutSpy).toHaveBeenCalled();
    flush();
  }));

  it('user activity resets the countdown', fakeAsync(() => {
    TestBed.inject(SessionTimeoutService);
    tick(0);

    // A los 20 minutos el usuario interactúa
    tick(20 * 60 * 1000);
    document.dispatchEvent(new Event('click'));

    // 20 minutos más (40 en total, pero solo 20 desde la última actividad)
    tick(20 * 60 * 1000);
    expect(logoutSpy).not.toHaveBeenCalled();

    // 10 minutos más sin actividad completan la media hora
    tick(10 * 60 * 1000 + CHECK_MS);
    expect(logoutSpy).toHaveBeenCalled();
    flush();
  }));

  it('does nothing while logged out', fakeAsync(() => {
    loggedIn.set(false);
    TestBed.inject(SessionTimeoutService);
    tick(0);

    tick(TIMEOUT_MS + CHECK_MS);

    expect(logoutSpy).not.toHaveBeenCalled();
    flush();
  }));
});

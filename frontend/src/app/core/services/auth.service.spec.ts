import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';
import { AuthResponse } from '../models';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;

  const mockAuth: AuthResponse = {
    accessToken: 'access-123',
    refreshToken: 'refresh-456',
    user: {
      id: 1,
      username: 'ana',
      email: 'ana@test.com',
      avatarUrl: null,
      readingGoal: null,
      createdAt: '2026-01-01T00:00:00'
    }
  };

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])]
    });
    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('starts logged out', () => {
    expect(service.isLoggedIn()).toBeFalse();
    expect(service.user()).toBeNull();
  });

  it('stores tokens and user on login', () => {
    service.login({ username: 'ana', password: 'secret123' }).subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/auth/login`);
    expect(req.request.method).toBe('POST');
    req.flush({ success: true, message: 'OK', data: mockAuth, timestamp: '' });

    expect(service.isLoggedIn()).toBeTrue();
    expect(service.user()?.username).toBe('ana');
    expect(service.accessToken).toBe('access-123');
    expect(service.refreshToken).toBe('refresh-456');
  });

  it('clears session on logout', () => {
    service.login({ username: 'ana', password: 'secret123' }).subscribe();
    httpMock
      .expectOne(`${environment.apiUrl}/auth/login`)
      .flush({ success: true, message: 'OK', data: mockAuth, timestamp: '' });

    service.logout();

    expect(service.isLoggedIn()).toBeFalse();
    expect(service.accessToken).toBeNull();
    expect(localStorage.getItem('mylibrary-user')).toBeNull();
  });

  it('sends the refresh token on refresh', () => {
    localStorage.setItem('mylibrary-refresh-token', 'refresh-456');

    service.refresh().subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/auth/refresh`);
    expect(req.request.body).toEqual({ refreshToken: 'refresh-456' });
    req.flush({ success: true, message: 'OK', data: mockAuth, timestamp: '' });
  });
});

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { ProfilePage } from './profile.page';
import { AuthService } from '../../core/services/auth.service';
import { environment } from '../../../environments/environment';
import { signal } from '@angular/core';
import { User } from '../../core/models';

const user: User = {
  id: 1,
  username: 'ana',
  email: 'ana@test.com',
  avatarUrl: null,
  readingGoal: null,
  createdAt: '2026-01-01T00:00:00'
};

describe('ProfilePage — cambio de contraseña', () => {
  let fixture: ComponentFixture<ProfilePage>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProfilePage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: AuthService,
          useValue: { user: signal(user), updateStoredUser: () => {}, isLoggedIn: signal(true) }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ProfilePage);
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => httpMock.verify());

  function setPasswordForm(current: string, next: string, confirm: string): void {
    const form = (fixture.componentInstance as any).passwordForm;
    form.setValue({ currentPassword: current, newPassword: next, confirmPassword: confirm });
    fixture.detectChanges();
  }

  it('sends current and new password, omitting the confirmation field', () => {
    setPasswordForm('actual123', 'nueva4567', 'nueva4567');
    (fixture.componentInstance as any).changePassword();

    const req = httpMock.expectOne(`${environment.apiUrl}/profile/password`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({
      currentPassword: 'actual123',
      newPassword: 'nueva4567'
    });
    req.flush({ success: true, message: 'OK', data: null, timestamp: '' });
  });

  it('does not submit when the confirmation does not match', () => {
    setPasswordForm('actual123', 'nueva4567', 'otra-distinta');
    (fixture.componentInstance as any).changePassword();

    httpMock.expectNone(`${environment.apiUrl}/profile/password`);
  });

  it('does not submit when the new password is too short', () => {
    setPasswordForm('actual123', 'corta', 'corta');
    (fixture.componentInstance as any).changePassword();

    httpMock.expectNone(`${environment.apiUrl}/profile/password`);
  });

  it('clears the form after a successful change', () => {
    setPasswordForm('actual123', 'nueva4567', 'nueva4567');
    (fixture.componentInstance as any).changePassword();

    httpMock
      .expectOne(`${environment.apiUrl}/profile/password`)
      .flush({ success: true, message: 'OK', data: null, timestamp: '' });
    fixture.detectChanges();

    const form = (fixture.componentInstance as any).passwordForm;
    expect(form.value.currentPassword).toBeFalsy();
    expect(form.value.newPassword).toBeFalsy();
  });
});

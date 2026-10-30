import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { ResetPasswordPage } from './reset-password.page';
import { ForgotPasswordPage } from './forgot-password.page';
import { environment } from '../../../environments/environment';

describe('Recuperación de contraseña', () => {
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ResetPasswordPage, ForgotPasswordPage],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])]
    }).compileComponents();
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  describe('ForgotPasswordPage', () => {
    it('posts the email and shows the generic confirmation', () => {
      const fixture = TestBed.createComponent(ForgotPasswordPage);
      fixture.detectChanges();
      const cmp = fixture.componentInstance as any;
      cmp.form.setValue({ email: 'ana@test.com' });
      cmp.submit();

      const req = httpMock.expectOne(`${environment.apiUrl}/auth/forgot-password`);
      expect(req.request.body).toEqual({ email: 'ana@test.com' });
      req.flush({ success: true, message: 'OK', data: null, timestamp: '' });
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).toContain('Revisa tu correo');
    });

    it('does not submit an invalid email', () => {
      const fixture = TestBed.createComponent(ForgotPasswordPage);
      fixture.detectChanges();
      const cmp = fixture.componentInstance as any;
      cmp.form.setValue({ email: 'no-es-un-email' });
      cmp.submit();

      httpMock.expectNone(`${environment.apiUrl}/auth/forgot-password`);
    });
  });

  describe('ResetPasswordPage', () => {
    function create(token?: string): ComponentFixture<ResetPasswordPage> {
      const fixture = TestBed.createComponent(ResetPasswordPage);
      if (token !== undefined) fixture.componentRef.setInput('token', token);
      fixture.detectChanges();
      return fixture;
    }

    it('explains when the link has no token', () => {
      const fixture = create();
      expect(fixture.nativeElement.textContent).toContain('Este enlace no es válido');
      expect(fixture.nativeElement.querySelector('form')).toBeNull();
    });

    it('sends token and new password', () => {
      const fixture = create('abc123');
      const cmp = fixture.componentInstance as any;
      cmp.form.setValue({ password: 'nueva5678', confirm: 'nueva5678' });
      cmp.submit();

      const req = httpMock.expectOne(`${environment.apiUrl}/auth/reset-password`);
      expect(req.request.body).toEqual({ token: 'abc123', newPassword: 'nueva5678' });
      req.flush({ success: true, message: 'OK', data: null, timestamp: '' });
    });

    it('blocks mismatched passwords', () => {
      const fixture = create('abc123');
      const cmp = fixture.componentInstance as any;
      cmp.form.setValue({ password: 'nueva5678', confirm: 'otra' });
      cmp.submit();

      httpMock.expectNone(`${environment.apiUrl}/auth/reset-password`);
    });
  });
});

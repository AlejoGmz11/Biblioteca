import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpEvent, HttpEventType, HttpResponse, provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Observable, of, throwError } from 'rxjs';
import { EbookUploaderComponent } from './ebook-uploader.component';
import { ToastService } from '../../core/services/toast.service';
import { ApiResponse, Book } from '../../core/models';

describe('EbookUploaderComponent', () => {
  let fixture: ComponentFixture<EbookUploaderComponent>;
  let toast: jasmine.SpyObj<ToastService>;

  const okResponse = (): Observable<HttpEvent<ApiResponse<Book>>> =>
    of(
      { type: HttpEventType.UploadProgress, loaded: 50, total: 100 } as HttpEvent<ApiResponse<Book>>,
      new HttpResponse({ body: { success: true, message: 'OK', data: { id: 5 } as Book, timestamp: '' } })
    );

  beforeEach(async () => {
    toast = jasmine.createSpyObj<ToastService>('ToastService', ['success', 'error', 'info']);
    await TestBed.configureTestingModule({
      imports: [EbookUploaderComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: ToastService, useValue: toast }]
    }).compileComponents();

    fixture = TestBed.createComponent(EbookUploaderComponent);
  });

  function dropFile(file: File): void {
    const transfer = new DataTransfer();
    transfer.items.add(file);
    const zone: HTMLElement = fixture.nativeElement.querySelector('div');
    zone.dispatchEvent(new DragEvent('drop', { dataTransfer: transfer, bubbles: true }));
    fixture.detectChanges();
  }

  it('uploads a dropped file through uploadFn and emits the book', () => {
    const uploadFn = jasmine.createSpy('uploadFn').and.returnValue(okResponse());
    fixture.componentRef.setInput('uploadFn', uploadFn);
    fixture.detectChanges();
    const uploaded: Book[] = [];
    fixture.componentInstance.uploaded.subscribe((b) => uploaded.push(b));

    dropFile(new File(['%PDF'], 'libro.pdf', { type: 'application/pdf' }));

    expect(uploadFn).toHaveBeenCalledTimes(1);
    expect(uploaded.length).toBe(1);
    expect(uploaded[0].id).toBe(5);
  });

  it('rejects unsupported files before uploading', () => {
    const uploadFn = jasmine.createSpy('uploadFn').and.returnValue(okResponse());
    fixture.componentRef.setInput('uploadFn', uploadFn);
    fixture.detectChanges();

    dropFile(new File(['x'], 'libro.mobi'));

    expect(uploadFn).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(jasmine.stringMatching(/PDF o EPUB/));
  });

  it('shows the server error message when the upload fails', () => {
    const uploadFn = jasmine
      .createSpy('uploadFn')
      .and.returnValue(throwError(() => ({ error: { message: 'Formato no soportado' } })));
    fixture.componentRef.setInput('uploadFn', uploadFn);
    fixture.detectChanges();

    dropFile(new File(['<html>'], 'falso.pdf'));

    expect(toast.error).toHaveBeenCalledWith('Formato no soportado');
    // Vuelve a mostrar el botón de selección
    expect(fixture.nativeElement.querySelector('input[type=file]')).toBeTruthy();
  });
});

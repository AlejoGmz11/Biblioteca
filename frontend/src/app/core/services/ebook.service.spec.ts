import { TestBed } from '@angular/core/testing';
import { HttpEventType, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { EBOOK_MAX_SIZE_BYTES, EbookService } from './ebook.service';
import { environment } from '../../../environments/environment';

describe('EbookService', () => {
  let service: EbookService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(EbookService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  describe('validate', () => {
    it('accepts pdf and epub within the size limit', () => {
      expect(service.validate(new File(['x'], 'libro.pdf'))).toBeNull();
      expect(service.validate(new File(['x'], 'LIBRO.EPUB'))).toBeNull();
    });

    it('rejects other extensions', () => {
      expect(service.validate(new File(['x'], 'libro.mobi'))).toContain('PDF o EPUB');
    });

    it('rejects files over 100 MB', () => {
      const big = { name: 'grande.pdf', size: EBOOK_MAX_SIZE_BYTES + 1 } as File;
      expect(service.validate(big)).toContain('100 MB');
    });
  });

  it('attach posts multipart form data with progress events', () => {
    const file = new File(['%PDF'], 'libro.pdf', { type: 'application/pdf' });
    const events: HttpEventType[] = [];
    service.attach(5, file).subscribe((e) => events.push(e.type));

    const req = httpMock.expectOne(`${environment.apiUrl}/books/5/ebook`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body instanceof FormData).toBeTrue();
    expect((req.request.body as FormData).get('file')).toBeTruthy();
    expect(req.request.reportProgress).toBeTrue();
    req.flush({ success: true, message: 'OK', data: { id: 5 }, timestamp: '' });

    expect(events).toContain(HttpEventType.Response);
  });

  it('createFromFile sends optional title and author', () => {
    service.createFromFile(new File(['%PDF'], 'x.pdf'), 'Dune', undefined).subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/books/ebook`);
    const form = req.request.body as FormData;
    expect(form.get('title')).toBe('Dune');
    expect(form.has('author')).toBeFalse();
    req.flush({ success: true, message: 'OK', data: { id: 9 }, timestamp: '' });
  });

  it('fetchBlob requests the stream as a blob', () => {
    service.fetchBlob(5).subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/books/5/ebook`);
    expect(req.request.responseType).toBe('blob');
    req.flush(new Blob(['%PDF']));
  });

  it('remove unwraps the updated book', (done) => {
    service.remove(5).subscribe((book) => {
      expect(book.ebookFormat).toBeNull();
      done();
    });

    httpMock
      .expectOne(`${environment.apiUrl}/books/5/ebook`)
      .flush({ success: true, message: 'OK', data: { id: 5, ebookFormat: null }, timestamp: '' });
  });

  it('readUrl points to the authenticated stream endpoint', () => {
    expect(service.readUrl(7)).toBe(`${environment.apiUrl}/books/7/ebook`);
  });
});

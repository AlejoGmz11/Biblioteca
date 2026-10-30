import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { BookService } from './book.service';
import { environment } from '../../../environments/environment';

describe('BookService', () => {
  let service: BookService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(BookService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('builds query params from filters', () => {
    service.list({ status: 'READING', search: 'dune', page: 2, size: 24 }).subscribe();

    const req = httpMock.expectOne(
      (r) => r.url === `${environment.apiUrl}/books`
    );
    expect(req.request.params.get('status')).toBe('READING');
    expect(req.request.params.get('search')).toBe('dune');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('size')).toBe('24');
    req.flush({ success: true, message: 'OK', data: { content: [] }, timestamp: '' });
  });

  it('omits empty filters', () => {
    service.list({}).subscribe();

    const req = httpMock.expectOne((r) => r.url === `${environment.apiUrl}/books`);
    expect(req.request.params.has('status')).toBeFalse();
    expect(req.request.params.has('search')).toBeFalse();
    req.flush({ success: true, message: 'OK', data: { content: [] }, timestamp: '' });
  });

  it('unwraps the ApiResponse envelope', (done) => {
    service.get(5).subscribe((book) => {
      expect(book.title).toBe('Dune');
      done();
    });

    httpMock.expectOne(`${environment.apiUrl}/books/5`).flush({
      success: true,
      message: 'OK',
      data: { id: 5, title: 'Dune' },
      timestamp: ''
    });
  });

  it('patches the reading session', () => {
    service.updateSession(5, { status: 'FINISHED', rating: 5 }).subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/books/5/session`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ status: 'FINISHED', rating: 5 });
    req.flush({ success: true, message: 'OK', data: {}, timestamp: '' });
  });

  it('resolves cover URLs', () => {
    expect(service.coverUrl({ imageUrl: 'https://x/y.jpg', imagePath: null })).toBe('https://x/y.jpg');
    expect(service.coverUrl({ imageUrl: null, imagePath: 'abc.png' })).toBe(
      `${environment.apiUrl}/images/abc.png`
    );
    expect(service.coverUrl({ imageUrl: null, imagePath: null })).toBeNull();
  });
});

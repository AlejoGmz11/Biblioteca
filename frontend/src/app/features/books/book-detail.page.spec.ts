import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { BookDetailPage } from './book-detail.page';
import { environment } from '../../../environments/environment';
import { Book, ReadingSession } from '../../core/models';

function mockSession(overrides: Partial<ReadingSession> = {}): ReadingSession {
  return {
    id: 1,
    bookId: 1,
    status: 'PENDING',
    startDate: null,
    endDate: null,
    rating: null,
    notes: null,
    currentPage: null,
    ebookLocation: null,
    createdAt: '2026-01-01T00:00:00',
    ...overrides
  };
}

function mockBook(id: number, title: string, overrides: Partial<Book> = {}): Book {
  return {
    id,
    title,
    author: 'Rick Riordan',
    isbn: null,
    pages: 300,
    categories: [],
    sagaId: null,
    sagaName: null,
    sagaOrder: null,
    type: 'PHYSICAL',
    imageUrl: null,
    imagePath: null,
    description: null,
    ebookFormat: null,
    ebookSize: null,
    createdAt: '2026-01-01T00:00:00',
    updatedAt: '2026-01-01T00:00:00',
    session: null,
    ...overrides
  };
}

function envelope<T>(data: T) {
  return { success: true, message: 'OK', data, timestamp: '' };
}

describe('BookDetailPage', () => {
  let fixture: ComponentFixture<BookDetailPage>;
  let httpMock: HttpTestingController;

  const root = () => fixture.nativeElement as HTMLElement;
  const text = () => root().textContent ?? '';
  const byLabel = (label: string) => root().querySelector(`button[aria-label="${label}"]`) as HTMLButtonElement;

  function loadBook(book: Book): void {
    fixture.componentRef.setInput('id', String(book.id));
    fixture.detectChanges();
    httpMock.expectOne(`${environment.apiUrl}/books/${book.id}`).flush(envelope(book));
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BookDetailPage],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(BookDetailPage);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('loads the book for the initial route id', () => {
    loadBook(mockBook(1, 'El ladrón del rayo'));

    expect(text()).toContain('El ladrón del rayo');
  });

  it('reloads when navigating to another book of the same route (saga links)', () => {
    loadBook(mockBook(1, 'El ladrón del rayo'));

    // Misma ruta, distinto parámetro: el componente se reutiliza
    fixture.componentRef.setInput('id', '2');
    fixture.detectChanges();

    httpMock
      .expectOne(`${environment.apiUrl}/books/2`)
      .flush(envelope(mockBook(2, 'El mar de los monstruos')));
    fixture.detectChanges();

    expect(text()).toContain('El mar de los monstruos');
    expect(text()).not.toContain('El ladrón del rayo');
  });

  describe('reading session', () => {
    it('shows the progress and the page stepper while reading', () => {
      loadBook(mockBook(1, 'Dune', { session: mockSession({ status: 'READING', currentPage: 150 }) }));

      expect(text()).toContain('pág. 150 de 300');
      expect(text()).toContain('te faltan 150');
      expect(root().querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('50');
      expect(root().querySelector('#current-page')).not.toBeNull();
    });

    it('saves the next page when pressing "+"', () => {
      loadBook(mockBook(1, 'Dune', { session: mockSession({ status: 'READING', currentPage: 150 }) }));

      byLabel('Una página más').click();

      const req = httpMock.expectOne(`${environment.apiUrl}/books/1/session`);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({ currentPage: 151 });
      req.flush(envelope(mockSession({ status: 'READING', currentPage: 151 })));
      fixture.detectChanges();

      expect(text()).toContain('pág. 151 de 300');
    });

    it('does not step past the last page', () => {
      loadBook(mockBook(1, 'Dune', { session: mockSession({ status: 'READING', currentPage: 300 }) }));

      expect(byLabel('Una página más').disabled).toBeTrue();
      expect(byLabel('Una página menos').disabled).toBeFalse();
    });

    it('offers to start a pending book and marks it as reading', () => {
      loadBook(mockBook(1, 'Dune', { session: mockSession({ status: 'PENDING' }) }));

      const start = Array.from(root().querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Empezar a leer')
      );
      expect(start).toBeDefined();
      start!.click();

      const req = httpMock.expectOne(`${environment.apiUrl}/books/1/session`);
      expect(req.request.body).toEqual({ status: 'READING' });
      req.flush(envelope(mockSession({ status: 'READING', currentPage: 0 })));
      fixture.detectChanges();

      expect(text()).not.toContain('Empezar a leer');
      expect(text()).toContain('Actualizar página');
    });

    it('shows the rating instead of the stepper when finished', () => {
      loadBook(
        mockBook(1, 'Dune', { session: mockSession({ status: 'FINISHED', rating: 4, endDate: '2026-02-01' }) })
      );

      expect(root().querySelector('app-star-rating')).not.toBeNull();
      expect(root().querySelector('#current-page')).toBeNull();
      expect(text()).not.toContain('Empezar a leer');
      expect(text()).not.toContain('Actualizar página');
    });

    it('shows how long it took to read a finished book', () => {
      loadBook(
        mockBook(1, 'Dune', {
          session: mockSession({ status: 'FINISHED', startDate: '2026-01-01', endDate: '2026-01-18' })
        })
      );

      expect(text()).toContain('Duración');
      expect(text()).toContain('17 días');
    });
  });

  describe('book file', () => {
    it('opens the reader from the main action when the book has a file', () => {
      loadBook(
        mockBook(1, 'Dune', {
          ebookFormat: 'EPUB',
          ebookSize: 1_000_000,
          session: mockSession({ status: 'READING', currentPage: 10 })
        })
      );

      const link = root().querySelector('a[href="/books/1/read"]');
      expect(link?.textContent).toContain('Continuar leyendo');
      expect(text()).toContain('Archivo EPUB');
    });

    it('says so when there is no attached file', () => {
      loadBook(mockBook(1, 'Dune', { session: mockSession({ status: 'READING', currentPage: 10 }) }));

      expect(text()).toContain('Sin archivo adjunto');
      expect(text()).toContain('Adjuntar archivo');
    });
  });

  describe('actions menu', () => {
    it('asks for confirmation before deleting the book', () => {
      loadBook(mockBook(1, 'Dune', { session: mockSession() }));
      expect(root().querySelector('[role="menu"]')).toBeNull();

      byLabel('Más acciones').click();
      fixture.detectChanges();

      const item = root().querySelector('#book-menu [role="menuitem"]') as HTMLButtonElement;
      expect(item.textContent).toContain('Eliminar libro');

      item.click();
      fixture.detectChanges();

      expect(root().querySelector('[role="alertdialog"]')).not.toBeNull();
      expect(root().querySelector('#book-menu')).toBeNull();
    });
  });
});

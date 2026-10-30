import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { BookDetailPage } from './book-detail.page';
import { environment } from '../../../environments/environment';
import { Book } from '../../core/models';

function mockBook(id: number, title: string): Book {
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
    session: null
  };
}

function envelope(book: Book) {
  return { success: true, message: 'OK', data: book, timestamp: '' };
}

describe('BookDetailPage', () => {
  let fixture: ComponentFixture<BookDetailPage>;
  let httpMock: HttpTestingController;

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
    fixture.componentRef.setInput('id', '1');
    fixture.detectChanges();

    httpMock
      .expectOne(`${environment.apiUrl}/books/1`)
      .flush(envelope(mockBook(1, 'El ladrón del rayo')));
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('El ladrón del rayo');
  });

  it('reloads when navigating to another book of the same route (saga links)', () => {
    fixture.componentRef.setInput('id', '1');
    fixture.detectChanges();
    httpMock
      .expectOne(`${environment.apiUrl}/books/1`)
      .flush(envelope(mockBook(1, 'El ladrón del rayo')));
    fixture.detectChanges();

    // Misma ruta, distinto parámetro: el componente se reutiliza
    fixture.componentRef.setInput('id', '2');
    fixture.detectChanges();

    httpMock
      .expectOne(`${environment.apiUrl}/books/2`)
      .flush(envelope(mockBook(2, 'El mar de los monstruos')));
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('El mar de los monstruos');
    expect(fixture.nativeElement.textContent).not.toContain('El ladrón del rayo');
  });
});

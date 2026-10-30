import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { ReaderPage } from './reader.page';
import { Book } from '../../core/models';

function book(format: 'PDF' | 'EPUB'): Book {
  return {
    id: 1, title: 'Dune', author: 'Herbert', isbn: null, pages: null, categories: [],
    sagaId: null, sagaName: null, sagaOrder: null, type: 'DIGITAL', imageUrl: null, imagePath: null,
    description: null, ebookFormat: format, ebookSize: 10, createdAt: '', updatedAt: '', session: null
  };
}

/** Pie de progreso estilo Apple Books: página X de N, restantes del capítulo y porcentaje. */
describe('ReaderPage — pie de progreso', () => {
  let fixture: ComponentFixture<ReaderPage>;
  let cmp: any;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReaderPage],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])]
    }).compileComponents();
    fixture = TestBed.createComponent(ReaderPage);
    fixture.componentRef.setInput('id', '1');
    cmp = fixture.componentInstance;
  });

  afterEach(() => {
    // La página pide el libro al iniciarse; no es objeto de este test
    TestBed.inject(HttpTestingController).match(() => true).forEach((r) => r.flush(null, { status: 500, statusText: 'x' }));
  });

  describe('PDF', () => {
    beforeEach(() => {
      cmp.book.set(book('PDF'));
      cmp.totalPages.set(10);
    });

    it('shows real pages and percentage', () => {
      cmp.page.set(4);
      expect(cmp.pageLabel()).toBe('Página 4 de 10');
      expect(cmp.progressPercent()).toBe(40);
    });

    it('without outline counts pages to the end of the book', () => {
      cmp.page.set(7);
      expect(cmp.chapterLeftLabel()).toBe('Quedan 3 páginas para terminar');
      cmp.page.set(10);
      expect(cmp.chapterLeftLabel()).toBe('Última página');
    });

    it('with outline counts pages left in the current chapter', () => {
      cmp.pdfChapters.set([{ title: 'Cap 1', page: 1 }, { title: 'Cap 2', page: 5 }, { title: 'Cap 3', page: 8 }]);
      cmp.page.set(2);
      expect(cmp.chapterLeftLabel()).toBe('Quedan 2 páginas en este capítulo');
      cmp.page.set(4);
      expect(cmp.chapterLeftLabel()).toBe('Última página del capítulo');
      cmp.page.set(7);
      expect(cmp.chapterLeftLabel()).toBe('Última página del capítulo');
      cmp.page.set(9);
      expect(cmp.chapterLeftLabel()).toBe('Queda 1 página en este capítulo');
    });
  });

  describe('EPUB', () => {
    beforeEach(() => cmp.book.set(book('EPUB')));

    it('waits for locations before showing the page count', () => {
      cmp.epubProgress.set({ page: null, totalPages: null, percentage: null, chapterPage: 1, chapterTotal: 8 });
      expect(cmp.pageLabel()).toBe('Calculando páginas…');
      expect(cmp.progressPercent()).toBeNull();
      expect(cmp.chapterLeftLabel()).toBe('Quedan 7 páginas en este capítulo');
    });

    it('uses virtual pages and chapter screens once available', () => {
      cmp.epubProgress.set({ page: 19, totalPages: 27, percentage: 69, chapterPage: 8, chapterTotal: 8 });
      expect(cmp.pageLabel()).toBe('Página 19 de 27');
      expect(cmp.progressPercent()).toBe(69);
      expect(cmp.chapterLeftLabel()).toBe('Última página del capítulo');
    });
  });
});

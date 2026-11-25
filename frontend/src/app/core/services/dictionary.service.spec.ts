import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { DictionaryService } from './dictionary.service';
import { environment } from '../../../environments/environment';
import { DictionaryEntry } from '../models';

const entry: DictionaryEntry = {
  word: 'habían',
  found: true,
  lemmas: [{ lemma: 'haber', homonym: null, etymology: '', senses: [] }]
};

describe('DictionaryService', () => {
  let service: DictionaryService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(DictionaryService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('lowercases and url-encodes the word', () => {
    service.lookup('  Habían ').subscribe((result) => expect(result).toEqual(entry));

    const req = httpMock.expectOne(`${environment.apiUrl}/dictionary/hab%C3%ADan`);
    req.flush({ success: true, message: 'OK', data: entry, timestamp: '' });
  });

  it('answers a repeated word from memory without another request', () => {
    service.lookup('habían').subscribe();
    httpMock
      .expectOne(`${environment.apiUrl}/dictionary/hab%C3%ADan`)
      .flush({ success: true, message: 'OK', data: entry, timestamp: '' });

    let again: DictionaryEntry | undefined;
    service.lookup('Habían').subscribe((result) => (again = result));

    expect(again).toEqual(entry);
    httpMock.expectNone(`${environment.apiUrl}/dictionary/hab%C3%ADan`);
  });

  it('does not remember failed lookups', () => {
    service.lookup('casa').subscribe({ error: () => undefined });
    httpMock.expectOne(`${environment.apiUrl}/dictionary/casa`).flush('boom', { status: 502, statusText: 'Bad Gateway' });

    service.lookup('casa').subscribe();
    httpMock.expectOne(`${environment.apiUrl}/dictionary/casa`).flush({ success: true, message: 'OK', data: entry, timestamp: '' });
  });
});

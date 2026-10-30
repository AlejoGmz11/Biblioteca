import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ApiResponse,
  Book,
  BookFilters,
  BookPayload,
  PageResponse,
  ReadingSession,
  SessionPatch
} from '../models';

@Injectable({ providedIn: 'root' })
export class BookService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/books`;

  list(filters: BookFilters = {}): Observable<PageResponse<Book>> {
    let params = new HttpParams()
      .set('page', filters.page ?? 0)
      .set('size', filters.size ?? 12);
    if (filters.status) params = params.set('status', filters.status);
    if (filters.category) params = params.set('category', filters.category);
    if (filters.type) params = params.set('type', filters.type);
    if (filters.author) params = params.set('author', filters.author);
    if (filters.search) params = params.set('search', filters.search);
    if (filters.saga) params = params.set('saga', filters.saga);

    return this.http
      .get<ApiResponse<PageResponse<Book>>>(this.base, { params })
      .pipe(map((res) => res.data));
  }

  get(id: number): Observable<Book> {
    return this.http.get<ApiResponse<Book>>(`${this.base}/${id}`).pipe(map((res) => res.data));
  }

  create(payload: BookPayload): Observable<Book> {
    return this.http.post<ApiResponse<Book>>(this.base, payload).pipe(map((res) => res.data));
  }

  update(id: number, payload: BookPayload): Observable<Book> {
    return this.http.put<ApiResponse<Book>>(`${this.base}/${id}`, payload).pipe(map((res) => res.data));
  }

  delete(id: number): Observable<void> {
    return this.http.delete<ApiResponse<void>>(`${this.base}/${id}`).pipe(map(() => undefined));
  }

  getSession(bookId: number): Observable<ReadingSession> {
    return this.http
      .get<ApiResponse<ReadingSession>>(`${this.base}/${bookId}/session`)
      .pipe(map((res) => res.data));
  }

  updateSession(bookId: number, patch: SessionPatch): Observable<ReadingSession> {
    return this.http
      .patch<ApiResponse<ReadingSession>>(`${this.base}/${bookId}/session`, patch)
      .pipe(map((res) => res.data));
  }

  /** Resolves the displayable cover URL for a book (external URL or uploaded file). */
  coverUrl(book: Pick<Book, 'imageUrl' | 'imagePath'>): string | null {
    if (book.imageUrl) return book.imageUrl;
    if (book.imagePath) return `${environment.apiUrl}/images/${book.imagePath}`;
    return null;
  }
}

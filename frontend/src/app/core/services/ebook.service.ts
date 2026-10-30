import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpEvent } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse, Book } from '../models';
import { saveBlob } from '../utils/file-download';

/** Tamaño máximo aceptado por el backend (app.ebook.max-size-mb). */
export const EBOOK_MAX_SIZE_BYTES = 100 * 1024 * 1024;
export const EBOOK_ACCEPT = '.pdf,.epub,application/pdf,application/epub+zip';

@Injectable({ providedIn: 'root' })
export class EbookService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/books`;

  /** Adjunta (o sustituye) el archivo de un libro. Emite eventos de progreso. */
  attach(bookId: number, file: File): Observable<HttpEvent<ApiResponse<Book>>> {
    return this.http.post<ApiResponse<Book>>(`${this.base}/${bookId}/ebook`, this.formData(file), {
      reportProgress: true,
      observe: 'events'
    });
  }

  /** Crea un libro a partir del archivo; el backend extrae título/autor. */
  createFromFile(file: File, title?: string, author?: string): Observable<HttpEvent<ApiResponse<Book>>> {
    const form = this.formData(file);
    if (title) form.append('title', title);
    if (author) form.append('author', author);
    return this.http.post<ApiResponse<Book>>(`${this.base}/ebook`, form, {
      reportProgress: true,
      observe: 'events'
    });
  }

  /** URL del stream (el interceptor añade el JWT; soporta Range). */
  readUrl(bookId: number): string {
    return `${this.base}/${bookId}/ebook`;
  }

  /** Descarga el archivo completo como Blob (lector EPUB y caché offline). */
  fetchBlob(bookId: number): Observable<Blob> {
    return this.http.get(this.readUrl(bookId), { responseType: 'blob' });
  }

  /** Descarga el original al dispositivo con el nombre que indique el servidor. */
  download(bookId: number, fallbackName: string): Observable<void> {
    return this.http
      .get(`${this.base}/${bookId}/ebook/download`, { responseType: 'blob', observe: 'response' })
      .pipe(
        map((response) => {
          const name = this.filenameFrom(response.headers.get('Content-Disposition')) ?? fallbackName;
          saveBlob(response.body as Blob, name);
        })
      );
  }

  remove(bookId: number): Observable<Book> {
    return this.http
      .delete<ApiResponse<Book>>(`${this.base}/${bookId}/ebook`)
      .pipe(map((res) => res.data));
  }

  /** Validación en cliente antes de subir: extensión y tamaño. */
  validate(file: File): string | null {
    const name = file.name.toLowerCase();
    if (!name.endsWith('.pdf') && !name.endsWith('.epub')) {
      return 'Solo se admiten archivos PDF o EPUB';
    }
    if (file.size > EBOOK_MAX_SIZE_BYTES) {
      return 'El archivo supera el máximo de 100 MB';
    }
    return null;
  }

  private formData(file: File): FormData {
    const form = new FormData();
    form.append('file', file, file.name);
    return form;
  }

  /** Extrae el nombre de Content-Disposition (soporta filename*=UTF-8''…). */
  private filenameFrom(header: string | null): string | null {
    if (!header) return null;
    const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(header);
    if (utf8) return decodeURIComponent(utf8[1]);
    const plain = /filename="?([^";]+)"?/i.exec(header);
    return plain ? plain[1] : null;
  }
}

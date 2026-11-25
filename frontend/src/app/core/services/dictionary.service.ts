import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, tap } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { ApiResponse, DictionaryEntry } from '../models';

/** Definiciones del lector. El servidor ya cachea; aquí además se recuerdan las de la sesión. */
@Injectable({ providedIn: 'root' })
export class DictionaryService {
  private readonly http = inject(HttpClient);
  private readonly seen = new Map<string, DictionaryEntry>();

  lookup(word: string): Observable<DictionaryEntry> {
    const key = word.trim().toLowerCase();
    const known = this.seen.get(key);
    if (known) {
      return of(known);
    }
    return this.http
      .get<ApiResponse<DictionaryEntry>>(`${environment.apiUrl}/dictionary/${encodeURIComponent(key)}`)
      .pipe(
        map((res) => res.data),
        tap((entry) => this.seen.set(key, entry))
      );
  }
}

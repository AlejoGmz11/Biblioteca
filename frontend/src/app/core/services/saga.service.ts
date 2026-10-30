import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse, Saga } from '../models';

@Injectable({ providedIn: 'root' })
export class SagaService {
  private readonly http = inject(HttpClient);

  list(): Observable<Saga[]> {
    return this.http
      .get<ApiResponse<Saga[]>>(`${environment.apiUrl}/sagas`)
      .pipe(map((res) => res.data));
  }

  /** Etiqueta según el número de libros: bilogía, trilogía o saga. */
  kindLabel(saga: Saga): string {
    switch (saga.bookCount) {
      case 2:
        return 'Bilogía';
      case 3:
        return 'Trilogía';
      default:
        return 'Saga';
    }
  }
}

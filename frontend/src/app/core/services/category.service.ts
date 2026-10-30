import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse, Category } from '../models';

export interface CategoryPayload {
  name: string;
}

@Injectable({ providedIn: 'root' })
export class CategoryService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/categories`;

  list(): Observable<Category[]> {
    return this.http.get<ApiResponse<Category[]>>(this.base).pipe(map((res) => res.data));
  }

  create(payload: CategoryPayload): Observable<Category> {
    return this.http.post<ApiResponse<Category>>(this.base, payload).pipe(map((res) => res.data));
  }

  update(id: number, payload: CategoryPayload): Observable<Category> {
    return this.http.put<ApiResponse<Category>>(`${this.base}/${id}`, payload).pipe(map((res) => res.data));
  }

  delete(id: number): Observable<void> {
    return this.http.delete<ApiResponse<void>>(`${this.base}/${id}`).pipe(map(() => undefined));
  }
}

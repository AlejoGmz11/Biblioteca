import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse, Stats } from '../models';

@Injectable({ providedIn: 'root' })
export class StatsService {
  private readonly http = inject(HttpClient);

  dashboard(): Observable<Stats> {
    return this.http
      .get<ApiResponse<Stats>>(`${environment.apiUrl}/stats/dashboard`)
      .pipe(map((res) => res.data));
  }
}

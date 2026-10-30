import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse, User } from '../models';

export interface ProfilePayload {
  username: string;
  email: string;
  avatarUrl?: string | null;
}

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/profile`;

  update(payload: ProfilePayload): Observable<User> {
    return this.http.patch<ApiResponse<User>>(this.base, payload).pipe(map((res) => res.data));
  }

  changePassword(payload: ChangePasswordPayload): Observable<void> {
    return this.http
      .patch<ApiResponse<void>>(`${this.base}/password`, payload)
      .pipe(map(() => undefined));
  }
}

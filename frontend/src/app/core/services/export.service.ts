import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { saveBlob } from '../utils/file-download';

@Injectable({ providedIn: 'root' })
export class ExportService {
  private readonly http = inject(HttpClient);

  download(format: 'csv' | 'json'): Observable<Blob> {
    return this.http.get(`${environment.apiUrl}/export/${format}`, { responseType: 'blob' });
  }

  saveBlob(blob: Blob, filename: string): void {
    saveBlob(blob, filename);
  }
}

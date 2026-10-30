import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { EbookFormat } from '../models';

export interface CachedEbook {
  bookId: number;
  title: string;
  author: string;
  format: EbookFormat;
  size: number;
  savedAt: number;
  blob: Blob;
}

export type CachedEbookSummary = Omit<CachedEbook, 'blob'>;

const DB_NAME = 'mylibrary';
const DB_VERSION = 1;
const STORE = 'ebooks';

/**
 * Libros guardados para leer sin conexión. Se usa IndexedDB porque el
 * service worker de Angular no cachea descargas dinámicas grandes; aquí cabe
 * el archivo completo junto a los datos mínimos para abrir el lector offline.
 */
@Injectable({ providedIn: 'root' })
export class EbookCacheService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private db: Promise<IDBDatabase> | null = null;

  /** Ids de los libros disponibles offline (para pintar el estado en la UI). */
  readonly cachedIds = signal<Set<number>>(new Set());

  constructor() {
    if (this.isBrowser && 'indexedDB' in window) {
      void this.refreshIds();
    }
  }

  get available(): boolean {
    return this.isBrowser && 'indexedDB' in window;
  }

  async get(bookId: number): Promise<CachedEbook | null> {
    if (!this.available) return null;
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const request = db.transaction(STORE, 'readonly').objectStore(STORE).get(bookId);
      request.onsuccess = () => resolve((request.result as CachedEbook) ?? null);
      request.onerror = () => reject(request.error);
    });
  }

  async save(entry: CachedEbook): Promise<void> {
    if (!this.available) return;
    const db = await this.open();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(entry);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    this.cachedIds.update((ids) => new Set(ids).add(entry.bookId));
  }

  async remove(bookId: number): Promise<void> {
    if (!this.available) return;
    const db = await this.open();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(bookId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    this.cachedIds.update((ids) => {
      const next = new Set(ids);
      next.delete(bookId);
      return next;
    });
  }

  /** Resumen de todo lo guardado, sin cargar los blobs en memoria. */
  async list(): Promise<CachedEbookSummary[]> {
    if (!this.available) return [];
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const request = db.transaction(STORE, 'readonly').objectStore(STORE).openCursor();
      const items: CachedEbookSummary[] = [];
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) {
          resolve(items);
          return;
        }
        const { blob: _blob, ...summary } = cursor.value as CachedEbook;
        items.push(summary);
        cursor.continue();
      };
      request.onerror = () => reject(request.error);
    });
  }

  private async refreshIds(): Promise<void> {
    try {
      const items = await this.list();
      this.cachedIds.set(new Set(items.map((i) => i.bookId)));
    } catch {
      // Sin IndexedDB utilizable (modo privado, cuota…): la app sigue funcionando sin offline
    }
  }

  private open(): Promise<IDBDatabase> {
    if (!this.db) {
      this.db = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(STORE)) {
            db.createObjectStore(STORE, { keyPath: 'bookId' });
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }
    return this.db;
  }
}

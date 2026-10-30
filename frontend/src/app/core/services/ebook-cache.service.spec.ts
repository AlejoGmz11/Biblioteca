import { TestBed } from '@angular/core/testing';
import { EbookCacheService } from './ebook-cache.service';

describe('EbookCacheService (IndexedDB)', () => {
  let service: EbookCacheService;
  // Id improbable para no chocar con otros tests que compartan la base de datos
  const bookId = 987_654;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(EbookCacheService);
  });

  afterEach(async () => {
    await service.remove(bookId);
  });

  it('is available in the browser', () => {
    expect(service.available).toBeTrue();
  });

  it('saves, lists, reads and removes a book', async () => {
    const blob = new Blob(['%PDF-1.4'], { type: 'application/pdf' });
    await service.save({ bookId, title: 'Dune', author: 'Herbert', format: 'PDF', size: blob.size, savedAt: 1, blob });

    expect(service.cachedIds().has(bookId)).toBeTrue();
    const summary = (await service.list()).find((s) => s.bookId === bookId);
    expect(summary?.title).toBe('Dune');
    expect(summary && 'blob' in summary).toBeFalse();

    const entry = await service.get(bookId);
    expect(entry?.format).toBe('PDF');
    expect(await entry!.blob.text()).toBe('%PDF-1.4');

    await service.remove(bookId);
    expect(service.cachedIds().has(bookId)).toBeFalse();
    expect(await service.get(bookId)).toBeNull();
  });
});

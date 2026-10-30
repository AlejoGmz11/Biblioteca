import { BookTypeLabelPipe } from './book-type-label.pipe';
import { ReadingStatusLabelPipe } from './reading-status-label.pipe';

describe('BookTypeLabelPipe', () => {
  const pipe = new BookTypeLabelPipe();

  it('translates book types to Spanish labels', () => {
    expect(pipe.transform('PHYSICAL')).toBe('Físico');
    expect(pipe.transform('DIGITAL')).toBe('Digital');
    expect(pipe.transform('AUDIOBOOK')).toBe('Audiolibro');
  });

  it('returns an empty string for null or undefined', () => {
    expect(pipe.transform(null)).toBe('');
    expect(pipe.transform(undefined)).toBe('');
  });
});

describe('ReadingStatusLabelPipe', () => {
  const pipe = new ReadingStatusLabelPipe();

  it('translates reading statuses to Spanish labels', () => {
    expect(pipe.transform('PENDING')).toBe('Pendiente');
    expect(pipe.transform('READING')).toBe('Leyendo');
    expect(pipe.transform('FINISHED')).toBe('Terminado');
  });

  it('returns an empty string for null', () => {
    expect(pipe.transform(null)).toBe('');
  });
});

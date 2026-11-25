import { extractWord } from './epub-reader.component';

describe('extractWord', () => {
  it('trims the trailing space a double click selects on Windows', () => {
    expect(extractWord('faroles ')).toBe('faroles');
  });

  it('removes punctuation around the word', () => {
    expect(extractWord('«Hogwarts,»')).toBe('Hogwarts');
    expect(extractWord('—Hay')).toBe('Hay');
  });

  it('keeps accents, apostrophes and hyphens inside the word', () => {
    expect(extractWord('habían')).toBe('habían');
    expect(extractWord("d'Artagnan")).toBe("d'Artagnan");
    expect(extractWord('hispano-americano')).toBe('hispano-americano');
  });

  it('ignores anything that is not a single word', () => {
    expect(extractWord('')).toBeNull();
    expect(extractWord('   ')).toBeNull();
    expect(extractWord('dos palabras')).toBeNull();
    expect(extractWord('1234')).toBeNull();
    expect(extractWord('a'.repeat(61))).toBeNull();
  });
});

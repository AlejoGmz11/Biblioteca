import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { DictionaryPanelComponent } from './dictionary-panel.component';
import { environment } from '../../../environments/environment';
import { DictionaryEntry, DictionarySense } from '../../core/models';

const sense = (number: string, definition: string, extra: Partial<DictionarySense> = {}): DictionarySense => ({
  number, category: 'sustantivo masculino', usage: '', definition, examples: [], ...extra
});

const farol: DictionaryEntry = {
  word: 'faroles',
  found: true,
  lemmas: [{
    lemma: 'farol', homonym: null, etymology: 'De faro.',
    senses: [
      sense('1.a', 'Caja de vidrio', { examples: ['Un farol iluminaba la puerta.'] }),
      sense('1.b', 'Cazoleta de hierro'),
      sense('2', 'Luz de una vía pública', { usage: 'desusado' }),
      sense('3', 'Fanal'),
      sense('4', 'Quinta acepción')
    ]
  }]
};

describe('DictionaryPanelComponent', () => {
  let fixture: ComponentFixture<DictionaryPanelComponent>;
  let httpMock: HttpTestingController;
  const text = () => fixture.nativeElement.textContent.replace(/\s+/g, ' ');

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DictionaryPanelComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()]
    }).compileComponents();
    fixture = TestBed.createComponent(DictionaryPanelComponent);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  function ask(word: string, id = 1) {
    fixture.componentRef.setInput('request', { word, id });
    fixture.detectChanges();
    return httpMock.expectOne(`${environment.apiUrl}/dictionary/${encodeURIComponent(word)}`);
  }

  const answer = (req: TestRequest, entry: DictionaryEntry) =>
    req.flush({ success: true, message: 'OK', data: entry, timestamp: '' });

  it('shows a hint when nothing has been asked yet', () => {
    fixture.detectChanges();
    expect(text()).toContain('Doble clic en una palabra del libro');
  });

  it('suggests typing a word when text cannot be selected (PDF)', () => {
    fixture.componentRef.setInput('canSelect', false);
    fixture.detectChanges();
    expect(text()).toContain('Escribe una palabra');
    expect(text()).not.toContain('Doble clic');
  });

  it('shows the lemma, the first senses and an example for a found word', () => {
    answer(ask('faroles'), farol);
    fixture.detectChanges();

    expect(text()).toContain('farol');
    expect(text()).toContain('Forma de «farol»');
    expect(text()).toContain('Caja de vidrio.');
    expect(text()).toContain('Un farol iluminaba la puerta.');
    expect(text()).toContain('Origen: De faro.');
  });

  it('does not call a word a form of its own entry when the lemma lists variants', () => {
    answer(ask('llegado'), {
      word: 'llegado',
      found: true,
      lemmas: [{ lemma: 'llegado, llegada', homonym: null, etymology: '', senses: [sense('1', 'Cercano')] }]
    });
    fixture.detectChanges();

    expect(text()).toContain('llegado, llegada');
    expect(text()).not.toContain('Forma de');
  });

  it('collapses long entries and expands them on demand', () => {
    answer(ask('faroles'), farol);
    fixture.detectChanges();
    expect(text()).not.toContain('Quinta acepción');

    const more = [...fixture.nativeElement.querySelectorAll('button')].find(
      (b: HTMLButtonElement) => b.textContent?.includes('Ver todas')
    ) as HTMLButtonElement;
    more.click();
    fixture.detectChanges();

    expect(text()).toContain('Quinta acepción');
    expect(text()).toContain('Ver menos');
  });

  it('says so when the word is not in the dictionary', () => {
    answer(ask('quidditch'), { word: 'quidditch', found: false, lemmas: [] });
    fixture.detectChanges();

    expect(text()).toContain('No hay resultados para «quidditch»');
    expect(fixture.nativeElement.querySelector('a[href^="https://dle.rae.es/"]')).toBeTruthy();
  });

  it('offers a retry when the lookup fails', () => {
    ask('casa').flush('boom', { status: 502, statusText: 'Bad Gateway' });
    fixture.detectChanges();
    expect(text()).toContain('No se pudo consultar el diccionario');

    const retry = [...fixture.nativeElement.querySelectorAll('button')].find(
      (b: HTMLButtonElement) => b.textContent?.includes('Reintentar')
    ) as HTMLButtonElement;
    retry.click();
    httpMock.expectOne(`${environment.apiUrl}/dictionary/casa`).flush({
      success: true, message: 'OK', timestamp: '',
      data: { word: 'casa', found: true, lemmas: [{ lemma: 'casa', homonym: null, etymology: '', senses: [sense('1', 'Edificio')] }] }
    });
    fixture.detectChanges();

    expect(text()).toContain('Edificio.');
  });

  it('keeps a history and searches again when a past word is clicked', () => {
    answer(ask('faroles'), farol);
    fixture.detectChanges();

    const chip = [...fixture.nativeElement.querySelectorAll('button')].find(
      (b: HTMLButtonElement) => b.textContent?.trim() === 'faroles'
    ) as HTMLButtonElement;
    expect(chip).toBeTruthy();
    chip.click();
    fixture.detectChanges();

    expect(text()).toContain('Caja de vidrio.'); // viene de la memoria del servicio, sin otra petición
  });

  it('searches the word typed in the box', () => {
    fixture.detectChanges();
    const input: HTMLInputElement = fixture.nativeElement.querySelector('input[type="search"]');
    input.value = '  Casa ';
    input.dispatchEvent(new Event('input'));
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit'));

    httpMock.expectOne(`${environment.apiUrl}/dictionary/casa`).flush({
      success: true, message: 'OK', timestamp: '',
      data: { word: 'casa', found: true, lemmas: [{ lemma: 'casa', homonym: null, etymology: '', senses: [sense('1', 'Edificio')] }] }
    });
    fixture.detectChanges();
    expect(text()).toContain('Edificio.');
  });
});

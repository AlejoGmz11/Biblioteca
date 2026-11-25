import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, catchError, map, of, switchMap, tap } from 'rxjs';
import { DictionaryEntry, DictionaryLemma } from '../../core/models';
import { DictionaryService } from '../../core/services/dictionary.service';
import { IconComponent } from '../../shared/components/icon.component';

/** Petición del lector: el `id` distingue dos consultas seguidas de la misma palabra. */
export interface DictionaryRequest {
  word: string;
  id: number;
}

type PanelState =
  | { kind: 'empty' }
  | { kind: 'loading'; word: string }
  | { kind: 'error'; word: string }
  | { kind: 'entry'; entry: DictionaryEntry };

/** Acepciones visibles antes de pulsar «Ver todas». */
const COLLAPSED_SENSES = 4;
const MAX_HISTORY = 8;

/**
 * Panel lateral del diccionario del lector. Muestra la definición de la palabra
 * pedida (doble clic en el libro) o de la que se escriba en el buscador, y
 * recuerda las consultadas durante la lectura.
 */
@Component({
  selector: 'app-dictionary-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <aside
      class="flex h-full flex-col border-l border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
      aria-label="Diccionario"
    >
      <div class="flex items-center justify-between gap-2 px-4 pt-3">
        <h2 class="cat-section-label !mb-0">Diccionario</h2>
        <button type="button" class="icon-btn !h-8 !w-8" (click)="closed.emit()" aria-label="Cerrar diccionario">
          <app-icon name="x-mark" [size]="14" />
        </button>
      </div>

      <form class="px-4 pb-3 pt-2" role="search" (submit)="onSubmit($event)">
        <div class="relative">
          <span class="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400" aria-hidden="true">
            <app-icon name="search" [size]="16" />
          </span>
          <input
            #box
            type="search"
            class="input w-full py-1.5 pl-9 pr-3 text-sm"
            placeholder="Buscar una palabra"
            aria-label="Buscar una palabra en el diccionario"
            autocomplete="off"
            autocapitalize="off"
            spellcheck="false"
            [value]="draft()"
            (input)="draft.set(box.value)"
            (keydown.escape)="closed.emit()"
          />
        </div>
      </form>

      <div class="min-h-0 flex-1 overflow-y-auto px-4 pb-4" aria-live="polite">
        @let s = state();
        @if (s.kind === 'loading') {
          <div class="animate-pulse space-y-3 pt-1" role="status" aria-label="Buscando la definición">
            <div class="h-6 w-1/2 rounded bg-slate-200 dark:bg-slate-700"></div>
            <div class="h-3 w-full rounded bg-slate-200 dark:bg-slate-700"></div>
            <div class="h-3 w-5/6 rounded bg-slate-200 dark:bg-slate-700"></div>
            <div class="h-3 w-2/3 rounded bg-slate-200 dark:bg-slate-700"></div>
          </div>
        } @else if (s.kind === 'error') {
          <div role="alert" class="pt-1 text-sm">
            <p class="font-medium">No se pudo consultar el diccionario.</p>
            <p class="mt-1 text-slate-500 dark:text-slate-400">Puede ser un fallo momentáneo del servicio.</p>
            <button type="button" class="btn-secondary mt-3" (click)="search(s.word)">Reintentar</button>
          </div>
        } @else if (s.kind === 'entry' && !s.entry.found) {
          <div class="pt-1 text-sm">
            <p class="font-medium">No hay resultados para «{{ s.entry.word }}».</p>
            <p class="mt-1 text-slate-500 dark:text-slate-400">
              Puede ser un nombre propio, una palabra inventada o tener una errata.
            </p>
            <a
              class="mt-3 inline-block text-primary-600 underline-offset-2 hover:underline dark:text-camel"
              [href]="raeUrl(s.entry.word)"
              target="_blank"
              rel="noopener noreferrer"
            >Buscar en la RAE</a>
          </div>
        } @else if (s.kind === 'entry') {
          @for (lemma of s.entry.lemmas; track $index) {
            <section class="pt-1" [class.mt-6]="!$first" [attr.aria-label]="lemma.lemma">
              <h3 class="font-serif text-xl font-bold leading-tight">
                {{ lemma.lemma }}@if (lemma.homonym) {<sup class="ml-0.5 text-xs">{{ lemma.homonym }}</sup>}
              </h3>
              @if (isInflection(lemma, s.entry.word)) {
                <p class="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Forma de «{{ lemma.lemma }}»</p>
              }

              <ol class="mt-3 space-y-3 text-sm" role="list">
                @for (sense of visibleSenses(lemma); track $index) {
                  <li>
                    @if (sense.category && sense.category !== lemma.senses[$index - 1]?.category) {
                      <p class="mb-1 text-xs italic text-slate-500 dark:text-slate-400">{{ sense.category }}</p>
                    }
                    <p class="leading-relaxed">
                      @if (sense.number) {
                        <span class="mr-1 font-semibold tabular-nums text-primary-600 dark:text-camel">{{ sense.number }}</span>
                      }
                      @if (sense.usage) {
                        <span class="mr-1 rounded bg-slate-100 px-1.5 py-0.5 text-xs dark:bg-slate-800">{{ sense.usage }}</span>
                      }
                      {{ sentence(sense.definition) }}
                    </p>
                    @for (example of sense.examples; track $index) {
                      <p class="mt-0.5 font-serif text-[13px] italic text-slate-500 dark:text-slate-400">{{ example }}</p>
                    }
                  </li>
                }
              </ol>

              @if (lemma.etymology) {
                <p class="mt-3 text-xs text-slate-500 dark:text-slate-400">Origen: {{ lemma.etymology }}</p>
              }
            </section>
          }

          @if (hasHiddenSenses(s.entry)) {
            <button type="button" class="btn-secondary mt-4 w-full" (click)="showAll.set(!showAll())">
              {{ showAll() ? 'Ver menos' : 'Ver todas las acepciones' }}
            </button>
          }
          <a
            class="mt-4 inline-block text-xs text-primary-600 underline-offset-2 hover:underline dark:text-camel"
            [href]="raeUrl(s.entry.lemmas[0].lemma)"
            target="_blank"
            rel="noopener noreferrer"
          >Ver en la RAE</a>
        } @else {
          <p class="pt-1 text-sm text-slate-500 dark:text-slate-400">
            {{ canSelect() ? 'Doble clic en una palabra del libro para ver su definición, o escribe una arriba.' : 'Escribe una palabra para ver su definición.' }}
          </p>
        }
      </div>

      @if (history().length > 0) {
        <div class="border-t border-slate-200 px-4 py-3 dark:border-slate-800">
          <p class="cat-section-label !mb-2">Consultadas</p>
          <div class="flex flex-wrap gap-1.5">
            @for (word of history(); track word) {
              <button
                type="button"
                class="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs transition-colors hover:bg-primary-100 dark:bg-slate-800 dark:hover:bg-primary-900/40"
                (click)="search(word)"
              >{{ word }}</button>
            }
          </div>
        </div>
      }
    </aside>
  `
})
export class DictionaryPanelComponent {
  private readonly dictionary = inject(DictionaryService);
  private readonly box = viewChild<ElementRef<HTMLInputElement>>('box');

  /** Palabra pedida desde el libro; cada petición nueva dispara una consulta. */
  readonly request = input<DictionaryRequest | null>(null);
  /** En PDF no se puede seleccionar texto: solo queda el buscador. */
  readonly canSelect = input(true);
  readonly closed = output<void>();

  protected readonly state = signal<PanelState>({ kind: 'empty' });
  protected readonly draft = signal('');
  protected readonly history = signal<string[]>([]);
  protected readonly showAll = signal(false);

  private readonly lookups = new Subject<string>();

  constructor() {
    this.lookups
      .pipe(
        tap((word) => this.state.set({ kind: 'loading', word })),
        // Si llega otra palabra mientras se busca la anterior, la respuesta vieja se descarta
        switchMap((word) =>
          this.dictionary.lookup(word).pipe(
            map((entry): PanelState => ({ kind: 'entry', entry })),
            catchError(() => of<PanelState>({ kind: 'error', word }))
          )
        ),
        takeUntilDestroyed()
      )
      .subscribe((state) => {
        this.state.set(state);
        if (state.kind === 'entry') {
          this.remember(state.entry.word);
        }
      });

    effect(() => {
      const request = this.request();
      if (request) {
        untracked(() => this.search(request.word));
      }
    });

    // Abierto a mano (sin palabra): el cursor va directo al buscador
    afterNextRender(() => {
      if (!this.request()) {
        this.box()?.nativeElement.focus();
      }
    });
  }

  protected onSubmit(event: Event): void {
    event.preventDefault();
    this.search(this.draft());
  }

  protected search(word: string): void {
    const clean = word.trim();
    if (!clean) return;
    this.draft.set(clean);
    this.showAll.set(false);
    this.lookups.next(clean);
  }

  protected visibleSenses(lemma: DictionaryLemma) {
    return this.showAll() ? lemma.senses : lemma.senses.slice(0, COLLAPSED_SENSES);
  }

  protected hasHiddenSenses(entry: DictionaryEntry): boolean {
    return entry.lemmas.some((lemma) => lemma.senses.length > COLLAPSED_SENSES);
  }

  /**
   * ¿La palabra buscada es una forma del lema («faroles» de «farol»)? El lema puede traer
   * varias variantes («llegado, llegada»): si la palabra es una de ellas, no es una forma.
   */
  protected isInflection(lemma: DictionaryLemma, word: string): boolean {
    return !lemma.lemma.split(',').some((variant) => variant.trim().toLowerCase() === word.toLowerCase());
  }

  /** El diccionario da las definiciones sin punto final. */
  protected sentence(text: string): string {
    return /[.!?…]$/.test(text) ? text : `${text}.`;
  }

  protected raeUrl(word: string): string {
    return `https://dle.rae.es/${encodeURIComponent(word)}`;
  }

  private remember(word: string): void {
    this.history.update((list) => [word, ...list.filter((w) => w !== word)].slice(0, MAX_HISTORY));
  }
}

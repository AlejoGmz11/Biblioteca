import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  NgZone,
  afterNextRender,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild
} from '@angular/core';
import type Book from 'epubjs/types/book';
import type Rendition from 'epubjs/types/rendition';
import type { NavItem } from 'epubjs/types/navigation';

export interface EpubTocItem {
  label: string;
  href: string;
  level: number;
}

/** Progreso de lectura al estilo Apple Books. Los nulos significan "aún no se sabe". */
export interface ReadingProgress {
  /** Página virtual actual y total del libro (localizaciones de epub.js). */
  page: number | null;
  totalPages: number | null;
  /** 0–100. */
  percentage: number | null;
  /** Pantalla actual y total dentro del capítulo (con la maquetación actual). */
  chapterPage: number | null;
  chapterTotal: number | null;
}

/** Tamaño de cada "página virtual" en caracteres, como hace Apple Books. */
const CHARS_PER_LOCATION = 1000;

/** Forma del evento `relocated` de epub.js (solo lo que usamos). */
interface EpubLocation {
  start: { cfi: string; href: string; displayed?: { page: number; total: number } };
}

/**
 * Lector EPUB sobre epub.js: paginado, con tema claro/oscuro sincronizado con
 * la app, tamaño de fuente ajustable y ubicación (CFI) para reanudar.
 */
@Component({
  selector: 'app-epub-reader',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block h-full w-full' },
  template: `
    @if (error()) {
      <p class="p-6 text-center text-sm text-red-600 dark:text-red-400" role="alert">{{ error() }}</p>
    } @else if (!ready()) {
      <p class="p-6 text-center text-sm text-slate-500" role="status">Preparando el libro…</p>
    }
    <!-- Márgenes de página: epub.js mide este contenedor para paginar el texto -->
    <div class="h-full w-full px-5 py-4 sm:px-10 sm:py-8">
      <div
        #viewer
        class="h-full w-full"
        [class.invisible]="!ready()"
        (touchstart)="onTouchStart($event)"
        (touchend)="onTouchEnd($event)"
      ></div>
    </div>
  `
})
export class EpubReaderComponent {
  private readonly zone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);

  readonly data = input.required<ArrayBuffer>();
  readonly initialLocation = input<string | null>(null);
  readonly dark = input(false);
  /** Tamaño de fuente en porcentaje (100 = el del libro). */
  readonly fontSize = input(100);

  readonly locationChange = output<string>();
  readonly chapterChange = output<string | null>();
  readonly tocLoaded = output<EpubTocItem[]>();
  readonly progressChange = output<ReadingProgress>();
  readonly loaded = output<void>();
  /** Clave para cachear las localizaciones en localStorage (p. ej. el id del libro). */
  readonly cacheKey = input<string | null>(null);

  protected readonly ready = signal(false);
  protected readonly error = signal<string | null>(null);

  private readonly viewer = viewChild.required<ElementRef<HTMLDivElement>>('viewer');

  private book: Book | null = null;
  private rendition: Rendition | null = null;
  private toc: EpubTocItem[] = [];
  private locationsReady = false;
  private lastLocation: EpubLocation | null = null;
  private touchStartX = 0;

  constructor() {
    afterNextRender(() => void this.load());

    effect(() => {
      const dark = this.dark();
      this.rendition?.themes.select(dark ? 'dark' : 'light');
    });
    effect(() => {
      const size = this.fontSize();
      this.rendition?.themes.fontSize(`${size}%`);
    });

    this.destroyRef.onDestroy(() => {
      this.rendition?.destroy();
      this.book?.destroy();
    });
  }

  next(): void {
    void this.rendition?.next();
  }

  prev(): void {
    void this.rendition?.prev();
  }

  goTo(href: string): void {
    void this.rendition?.display(href);
  }

  private async load(): Promise<void> {
    try {
      const ePub = (await import('epubjs')).default;
      this.book = ePub(this.data());
      this.rendition = this.book.renderTo(this.viewer().nativeElement, {
        width: '100%',
        height: '100%',
        flow: 'paginated',
        spread: 'none',
        allowScriptedContent: false
      });

      // Paleta tierra de la app dentro del iframe del libro
      // Tipografía de libro (serif, interlineado amplio, texto justificado) y fondo papel
      const typography = {
        'font-family': "Georgia, 'Iowan Old Style', 'Times New Roman', serif",
        'line-height': '1.7',
        'text-align': 'justify',
        hyphens: 'auto'
      };
      this.rendition.themes.register('light', {
        body: { ...typography, color: '#2f2a24', background: '#fbfaf5' },
        a: { color: '#7f4f24' }
      });
      this.rendition.themes.register('dark', {
        body: { ...typography, color: '#e6e2d6', background: '#1d2318' },
        a: { color: '#c9a97f' }
      });
      this.rendition.themes.select(this.dark() ? 'dark' : 'light');
      this.rendition.themes.fontSize(`${this.fontSize()}%`);

      this.rendition.on('relocated', (location: EpubLocation) => {
        this.lastLocation = location;
        this.zone.run(() => {
          this.locationChange.emit(location.start.cfi);
          this.chapterChange.emit(this.chapterFor(location.start.href));
          this.emitProgress(location);
        });
      });
      // Teclas dentro del iframe del libro
      this.rendition.on('keydown', (event: KeyboardEvent) => this.zone.run(() => this.onKey(event)));

      const navigation = await this.book.loaded.navigation;
      this.toc = this.flatten(navigation.toc, 0);
      this.tocLoaded.emit(this.toc);

      const start = this.initialLocation();
      try {
        await this.rendition.display(start ?? undefined);
      } catch {
        // CFI guardado inválido (p. ej. archivo sustituido): empezar por el principio
        await this.rendition.display();
      }
      this.ready.set(true);
      this.loaded.emit();

      // Páginas virtuales: se calculan en segundo plano (o se recuperan de la caché)
      void this.prepareLocations();
    } catch (e) {
      console.error(e);
      this.error.set('No se pudo abrir el EPUB');
    }
  }

  /**
   * Divide el libro en localizaciones de tamaño fijo para tener un "página X
   * de N" estable, como Apple Books. Es costoso en libros grandes, así que el
   * resultado se cachea en localStorage por libro.
   */
  private async prepareLocations(): Promise<void> {
    if (!this.book) return;
    const key = this.cacheKey() ? `mylibrary-epub-locations-${this.cacheKey()}` : null;
    try {
      const cached = key ? localStorage.getItem(key) : null;
      if (cached) {
        this.book.locations.load(cached);
      } else {
        await this.book.locations.generate(CHARS_PER_LOCATION);
        if (key) {
          try {
            localStorage.setItem(key, this.book.locations.save());
          } catch {
            /* sin espacio: se recalculará la próxima vez */
          }
        }
      }
      this.locationsReady = true;
      if (this.lastLocation) {
        this.emitProgress(this.lastLocation);
      }
    } catch (e) {
      console.warn('No se pudieron calcular las páginas del EPUB', e);
    }
  }

  private emitProgress(location: EpubLocation): void {
    const displayed = location.start.displayed;
    let page: number | null = null;
    let totalPages: number | null = null;
    let percentage: number | null = null;
    if (this.locationsReady && this.book) {
      const total = this.book.locations.length();
      // Las tipificaciones dicen Location, pero en tiempo de ejecución es el índice (0-based)
      const index = this.book.locations.locationFromCfi(location.start.cfi) as unknown as number;
      if (total > 0 && typeof index === 'number' && index >= 0) {
        totalPages = total;
        page = Math.min(total, index + 1);
        percentage = Math.round(this.book.locations.percentageFromCfi(location.start.cfi) * 100);
      }
    }
    this.progressChange.emit({
      page,
      totalPages,
      percentage,
      chapterPage: displayed?.page ?? null,
      chapterTotal: displayed?.total ?? null
    });
  }

  private onKey(event: KeyboardEvent): void {
    if (event.key === 'ArrowRight' || event.key === 'PageDown') this.next();
    if (event.key === 'ArrowLeft' || event.key === 'PageUp') this.prev();
  }

  private flatten(items: NavItem[], level: number): EpubTocItem[] {
    const result: EpubTocItem[] = [];
    for (const item of items) {
      result.push({ label: item.label.trim(), href: item.href, level });
      if (item.subitems?.length) {
        result.push(...this.flatten(item.subitems, level + 1));
      }
    }
    return result;
  }

  private chapterFor(href: string): string | null {
    const path = href.split('#')[0];
    const match = this.toc.find((item) => item.href.split('#')[0] === path)
      ?? this.toc.find((item) => path.endsWith(item.href.split('#')[0]));
    return match?.label ?? null;
  }

  // --- gestos táctiles ---

  onTouchStart(event: TouchEvent): void {
    this.touchStartX = event.changedTouches[0]?.clientX ?? 0;
  }

  onTouchEnd(event: TouchEvent): void {
    const delta = (event.changedTouches[0]?.clientX ?? 0) - this.touchStartX;
    if (Math.abs(delta) < 60) return;
    delta < 0 ? this.next() : this.prev();
  }
}

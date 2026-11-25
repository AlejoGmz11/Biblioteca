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
import type Section from 'epubjs/types/section';

export interface EpubTocItem {
  label: string;
  href: string;
  level: number;
}

/** Progreso de lectura al estilo Apple Books. Los nulos significan "aún no se sabe". */
export interface ReadingProgress {
  /** Página actual y total del libro con el tamaño de letra y de ventana actuales (total estimado). */
  page: number | null;
  totalPages: number | null;
  /** 0–100. */
  percentage: number | null;
  /** Pantalla actual y total dentro del capítulo (con la maquetación actual). */
  chapterPage: number | null;
  chapterTotal: number | null;
}

/** Cada cuántos caracteres se marca una localización; sirven para medir cuánto texto tiene cada sección. */
const CHARS_PER_LOCATION = 1000;

/** Papel y tinta del libro. Claro: crema (#fefae0) con el oliva oscuro del resto de la app. */
const PAPER = {
  light: { paper: '#fefae0', text: '#2e3221', link: '#8a5a2b', selection: '#d4a373', selectionText: '#2e3221' },
  dark: { paper: '#1d2318', text: '#e6e2d6', link: '#c9a97f', selection: '#936639', selectionText: '#fefae0' }
} as const;

/**
 * Palabra suelta de lo seleccionado en el libro, sin espacios ni signos alrededor
 * (un doble clic en Windows selecciona también el espacio final). Devuelve null si
 * es otra cosa: varias palabras, números o un trozo demasiado largo.
 */
export function extractWord(selection: string): string | null {
  const word = selection.trim().replace(/^[^\p{L}]+|[^\p{L}]+$/gu, '');
  return /^\p{L}[\p{L}'’-]{0,59}$/u.test(word) ? word : null;
}

/** Espera tras el último cambio de tamaño del visor antes de volver a maquetar. */
const RESIZE_DEBOUNCE_MS = 150;

/** Margen para que el libro termine de maquetarse antes de recolocar un ancla o un CFI. */
const LAYOUT_SETTLE_MS = 150;

/** Forma del evento `relocated` de epub.js (solo lo que usamos). */
interface EpubLocation {
  start: { cfi: string; href: string; index: number; displayed?: { page: number; total: number } };
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** Resuelve `href` contra la ruta del documento que lo contiene (p. ej. `Text/nav.xhtml`). */
function resolveAgainst(basePath: string, href: string): string {
  return safeDecode(new URL(href, `http://epub.invalid/${basePath}`).pathname.slice(1));
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
  /** Palabra suelta seleccionada en el libro (para el diccionario). */
  readonly wordSelected = output<string>();
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
  private resizeObserver: ResizeObserver | null = null;
  private resizeTimer: ReturnType<typeof setTimeout> | null = null;

  // Páginas reales: dependen del tamaño de letra y del tamaño de la ventana.
  /** Caracteres aproximados de cada sección del libro (por posición en el spine). */
  private sectionChars: number[] = [];
  /** Pantallas que ocupa cada sección ya abierta con la maquetación actual. */
  private readonly measuredScreens = new Map<number, number>();
  /** Letra + tamaño del visor con los que se midió `measuredScreens`. */
  private layoutKey = '';
  /** Tamaño de letra ya aplicado al libro, para no recolocar sin motivo. */
  private appliedFontSize: number | null = null;

  constructor() {
    afterNextRender(() => void this.load());

    effect(() => this.applyTheme(this.dark()));
    effect(() => this.applyFontSize(this.fontSize()));

    this.destroyRef.onDestroy(() => {
      this.resizeObserver?.disconnect();
      if (this.resizeTimer) clearTimeout(this.resizeTimer);
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

  /**
   * Claro u oscuro dentro del libro. Se hace con overrides de epub.js (estilos
   * en línea que se reemplazan) y no con un tema registrado por modo: epub.js
   * crea una hoja de estilos por tema y no las reordena, así que la del oscuro,
   * una vez insertada, ganaba siempre a la del claro y el libro se quedaba negro.
   */
  private applyTheme(dark: boolean): void {
    const themes = this.rendition?.themes;
    if (!themes) return;
    const palette = dark ? PAPER.dark : PAPER.light;
    themes.override('color', palette.text, true);
    themes.override('background', palette.paper, true);
    themes.override('--reader-link', palette.link);
    themes.override('--reader-selection', palette.selection);
    themes.override('--reader-selection-text', palette.selectionText);
  }

  /**
   * Reajusta el libro cuando su contenedor cambia de tamaño sin que cambie la
   * ventana (p. ej. al abrir el panel del diccionario); epub.js solo escucha a
   * la ventana. Conserva el punto de lectura.
   */
  private watchViewerSize(): void {
    const viewer = this.viewer().nativeElement;
    const sizeOf = () => `${viewer.clientWidth}x${viewer.clientHeight}`;
    let last = sizeOf();
    this.resizeObserver = new ResizeObserver(() => {
      if (sizeOf() === last) return;
      last = sizeOf();
      if (this.resizeTimer) clearTimeout(this.resizeTimer);
      this.resizeTimer = setTimeout(
        () => this.rendition?.resize(viewer.clientWidth, viewer.clientHeight),
        RESIZE_DEBOUNCE_MS
      );
    });
    this.resizeObserver.observe(viewer);
  }

  /**
   * Cambia el tamaño de letra y vuelve a maquetar la sección en el mismo punto
   * de lectura: así no se pierde el sitio y el pie recibe los totales nuevos
   * (con letra más grande el libro tiene más páginas).
   */
  private applyFontSize(size: number): void {
    const rendition = this.rendition;
    if (!rendition || size === this.appliedFontSize) return;
    const firstTime = this.appliedFontSize === null;
    this.appliedFontSize = size;
    rendition.themes.fontSize(`${size}%`);
    const cfi = this.lastLocation?.start.cfi;
    if (firstTime || !cfi) return;
    rendition.clear();
    void this.displaySettled(cfi).catch((e) => console.warn('No se pudo recolocar el libro', e));
  }

  /** Abre una entrada del índice. Devuelve `false` si el libro no tiene esa sección. */
  async goTo(href: string): Promise<boolean> {
    const rendition = this.rendition;
    if (!rendition) return false;
    const [path, fragment] = href.split('#');
    const section = this.findSection(path);
    try {
      if (section && !fragment) {
        // Sin ancla se abre por posición: epub.js no encuentra por href la primera sección del libro
        await rendition.display(section.index);
      } else {
        await this.displaySettled(href);
      }
      return true;
    } catch (e) {
      console.warn('No se pudo abrir el capítulo', href, e);
      return false;
    }
  }

  /**
   * Abre un punto concreto dentro de una sección (ancla o CFI). epub.js calcula
   * en qué página cae antes de que se aplique la tipografía del tema, así que
   * puede quedarse varias páginas antes: una vez asentada la maquetación se
   * vuelve a colocar en el mismo destino.
   */
  private async displaySettled(target: string): Promise<void> {
    const rendition = this.rendition;
    if (!rendition) return;
    await rendition.display(target);
    await new Promise((resolve) => setTimeout(resolve, LAYOUT_SETTLE_MS));
    if (this.rendition === rendition) {
      await rendition.display(target);
    }
  }

  /**
   * Sección del libro a la que apunta un enlace del índice. Esos enlaces son
   * relativos al documento del índice (p. ej. `Text/nav.xhtml` → `cap001.xhtml`),
   * mientras que epub.js busca las secciones por su ruta relativa al OPF
   * (`Text/cap001.xhtml`): sin esta traducción, el índice no navega.
   */
  private findSection(path: string): Section | null {
    if (!this.book) return null;
    const sections: Section[] = [];
    this.book.spine.each((section: Section) => sections.push(section));

    const navPath = this.book.packaging?.navPath || this.book.packaging?.ncxPath || '';
    const candidates = [resolveAgainst(navPath, path), safeDecode(path)];
    for (const candidate of candidates) {
      const match = sections.find((section) => safeDecode(section.href) === candidate);
      if (match) return match;
    }
    // Último recurso: mismo archivo en otra carpeta
    const fileName = '/' + safeDecode(path).split('/').pop();
    return sections.find((section) => ('/' + safeDecode(section.href)).endsWith(fileName)) ?? null;
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
      // Lo común a los dos modos va en el tema por defecto; los colores se aplican con applyTheme
      this.rendition.themes.default({
        body: typography,
        a: { color: 'var(--reader-link)' },
        // epub.js limita las imágenes al ancho de la columna en píxeles (!important), pero muchos
        // libros dan márgenes laterales a los títulos (p. ej. h1 con margin: 0 10%): la imagen
        // sobresalía de su caja y pasaba a la página siguiente. Esta regla, más específica,
        // la mantiene dentro de su contenedor.
        'body img, body svg': { 'max-width': '100% !important' },
        // La palabra que se consulta en el diccionario queda marcada con el acento de la app
        '::selection': { background: 'var(--reader-selection)', color: 'var(--reader-selection-text)' }
      });
      this.applyTheme(this.dark());
      this.applyFontSize(this.fontSize());

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
      // Selección terminada (doble clic o pulsación larga): si es una palabra, a consultarla
      this.rendition.on('selected', (_cfiRange: string, contents: { window: Window }) => {
        const word = extractWord(contents.window.getSelection()?.toString() ?? '');
        if (word) {
          this.zone.run(() => this.wordSelected.emit(word));
        }
      });

      const navigation = await this.book.loaded.navigation;
      this.toc = this.flatten(navigation.toc, 0);
      this.tocLoaded.emit(this.toc);

      const start = this.initialLocation();
      try {
        if (start) {
          await this.displaySettled(start);
        } else {
          await this.rendition.display();
        }
      } catch {
        // CFI guardado inválido (p. ej. archivo sustituido): empezar por el principio
        await this.rendition.display();
      }
      this.ready.set(true);
      this.loaded.emit();
      this.watchViewerSize();

      // Páginas virtuales: se calculan en segundo plano (o se recuperan de la caché)
      void this.prepareLocations();
    } catch (e) {
      console.error(e);
      this.error.set('No se pudo abrir el EPUB');
    }
  }

  /**
   * Divide el libro en localizaciones de tamaño fijo para saber cuánto texto
   * tiene cada sección (y el porcentaje leído). Es costoso en libros grandes,
   * así que el resultado se cachea en localStorage por libro.
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
      this.sectionChars = this.countSectionChars();
      this.locationsReady = true;
      if (this.lastLocation) {
        this.emitProgress(this.lastLocation);
      }
    } catch (e) {
      console.warn('No se pudieron calcular las páginas del EPUB', e);
    }
  }

  /** Texto de cada sección: nº de localizaciones que caen en ella × caracteres por localización. */
  private countSectionChars(): number[] {
    if (!this.book) return [];
    const counts: number[] = [];
    this.book.spine.each(() => counts.push(0));
    const cfis: string[] = JSON.parse(this.book.locations.save());
    for (const cfi of cfis) {
      // epubcfi(/6/N!…): N/2 − 1 es la posición de la sección en el spine
      const step = /^epubcfi\(\/6\/(\d+)/.exec(cfi);
      const index = step ? Number(step[1]) / 2 - 1 : -1;
      if (index >= 0 && index < counts.length) counts[index] += CHARS_PER_LOCATION;
    }
    return counts;
  }

  /**
   * Página actual y total con la maquetación actual. Las secciones ya abiertas
   * cuentan sus pantallas reales; el resto se estima por su cantidad de texto,
   * así que el total se afina a medida que se lee.
   */
  private realPages(location: EpubLocation): { page: number; totalPages: number } | null {
    const displayed = location.start.displayed;
    const viewer = this.viewer().nativeElement;
    const key = `${this.appliedFontSize}|${viewer.clientWidth}x${viewer.clientHeight}`;
    if (key !== this.layoutKey) {
      this.layoutKey = key;
      this.measuredScreens.clear();
    }
    if (displayed?.total) {
      this.measuredScreens.set(location.start.index, displayed.total);
    }
    if (!this.locationsReady || this.sectionChars.length === 0) return null;

    const perScreen = this.charsPerScreen(viewer);
    let before = 0;
    let total = 0;
    this.sectionChars.forEach((chars, index) => {
      const screens = this.measuredScreens.get(index) ?? Math.max(1, Math.round(chars / perScreen));
      if (index < location.start.index) before += screens;
      total += screens;
    });
    return { page: Math.min(total, before + (displayed?.page ?? 1)), totalPages: total };
  }

  /** Caracteres que entran en una pantalla: medido en lo ya leído o, si aún no hay datos, estimado. */
  private charsPerScreen(viewer: HTMLElement): number {
    let chars = 0;
    let screens = 0;
    for (const [index, count] of this.measuredScreens) {
      // Las secciones muy cortas (portada, dedicatoria) no son representativas
      if (this.sectionChars[index] >= 3 * CHARS_PER_LOCATION) {
        chars += this.sectionChars[index];
        screens += count;
      }
    }
    if (screens > 0) return chars / screens;
    // ~0,5 em de ancho por carácter y 1,7 em de alto por línea, más los espacios entre párrafos
    const fontPx = 16 * ((this.appliedFontSize ?? 100) / 100);
    return Math.max(200, (viewer.clientWidth * viewer.clientHeight) / (1.1 * fontPx * fontPx));
  }

  private emitProgress(location: EpubLocation): void {
    const displayed = location.start.displayed;
    const pages = this.realPages(location);
    const page = pages?.page ?? null;
    const totalPages = pages?.totalPages ?? null;
    let percentage: number | null = null;
    if (this.locationsReady && this.book && this.book.locations.length() > 0) {
      percentage = Math.round(this.book.locations.percentageFromCfi(location.start.cfi) * 100);
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
      // El href se guarda ya traducido a la ruta de la sección (ver findSection)
      const [path, fragment] = item.href.split('#');
      const section = this.findSection(path);
      const href = section ? section.href + (fragment ? `#${fragment}` : '') : item.href;
      result.push({ label: item.label.trim(), href, level });
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

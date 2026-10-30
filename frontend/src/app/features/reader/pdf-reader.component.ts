import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  NgZone,
  afterNextRender,
  afterRenderEffect,
  effect,
  inject,
  input,
  model,
  output,
  signal,
  untracked,
  viewChild,
  viewChildren
} from '@angular/core';
import type { PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask } from 'pdfjs-dist';

export interface PdfChapter {
  title: string;
  page: number;
}

/**
 * Lector de PDF sobre pdf.js. Dos modos: página a página (con gestos táctiles)
 * y desplazamiento continuo (renderizado perezoso de las páginas visibles).
 * El documento llega ya descargado (ArrayBuffer) para no depender de que el
 * token JWT siga vivo durante toda la lectura.
 */
@Component({
  selector: 'app-pdf-reader',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block h-full w-full' },
  template: `
    <div
      #container
      class="h-full w-full overflow-auto"
      [class.flex]="mode() === 'page'"
      [class.items-center]="mode() === 'page'"
      [class.justify-center]="mode() === 'page'"
      (touchstart)="onTouchStart($event)"
      (touchend)="onTouchEnd($event)"
    >
      @if (error()) {
        <p class="m-auto p-6 text-center text-sm text-red-600 dark:text-red-400" role="alert">{{ error() }}</p>
      } @else if (!ready()) {
        <p class="m-auto p-6 text-sm text-slate-500" role="status">Preparando el documento…</p>
      }

      @if (mode() === 'page') {
        <canvas #pageCanvas class="m-auto shadow-md" [class.hidden]="!ready()" aria-label="Página del documento"></canvas>
      } @else {
        <div class="mx-auto flex flex-col items-center gap-4 py-4">
          @for (n of pageNumbers(); track n) {
            <canvas
              #scrollCanvas
              class="shadow-lg"
              [attr.data-page]="n"
              [style.width.px]="pageSize().width"
              [style.height.px]="pageSize().height"
              [attr.aria-label]="'Página ' + n"
            ></canvas>
          }
        </div>
      }
    </div>
  `
})
export class PdfReaderComponent {
  private readonly zone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);

  readonly data = input.required<ArrayBuffer>();
  readonly mode = input<'page' | 'scroll'>('page');
  /** Multiplicador sobre el ajuste al ancho (1 = ancho completo). */
  readonly zoom = input(1);
  readonly page = model(1);

  readonly totalPages = output<number>();
  /** Capítulos del índice del PDF (si lo tiene), con su página de inicio. */
  readonly outlineLoaded = output<PdfChapter[]>();
  readonly loaded = output<void>();

  protected readonly ready = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly pageNumbers = signal<number[]>([]);
  /** Tamaño CSS de página (modo scroll) para reservar espacio antes de renderizar. */
  protected readonly pageSize = signal({ width: 0, height: 0 });

  private readonly container = viewChild.required<ElementRef<HTMLDivElement>>('container');
  private readonly pageCanvas = viewChild<ElementRef<HTMLCanvasElement>>('pageCanvas');

  private loadingTask: PDFDocumentLoadingTask | null = null;
  private doc: PDFDocumentProxy | null = null;
  private renderTask: RenderTask | null = null;
  private scrollListener: (() => void) | null = null;
  private scrollTimer: ReturnType<typeof setTimeout> | null = null;
  private rendered = new Set<number>();
  private touchStartX = 0;
  private resizeObserver: ResizeObserver | null = null;
  private suppressPageEmit = false;
  /** Clave zoom/modo con la que se montó el modo scroll; evita reconstruirlo por cambios de página. */
  private scrollSetupKey: string | null = null;
  /** Última página detectada por el seguimiento del scroll, para no volver a desplazar hacia ella. */
  private observerPage: number | null = null;
  /** Montajes del modo scroll: uno más reciente invalida a los anteriores (son asíncronos). */
  private setupVersion = 0;
  /** Escala vigente del modo scroll; null mientras no está montado. */
  private readonly scrollScale = signal<number | null>(null);
  /** Se incrementa al terminar cada montaje: re-dispara el enganche del seguimiento. */
  private readonly scrollReady = signal(0);
  private pendingScrollPage: number | null = null;
  private readonly scrollCanvases = viewChildren<ElementRef<HTMLCanvasElement>>('scrollCanvas');
  private lastWidth = 0;
  private lastHeight = 0;
  private resizeTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    afterNextRender(() => void this.load());

    // Los canvas del modo scroll ya están en el DOM: enganchar el seguimiento del scroll
    afterRenderEffect(() => {
      const canvases = this.scrollCanvases().map((c) => c.nativeElement);
      const scale = this.scrollScale();
      this.scrollReady();
      if (this.mode() !== 'scroll' || !canvases.length || scale === null) return;
      untracked(() => this.attachScrollTracking(canvases, scale));
    });

    effect(() => {
      const page = this.page();
      const zoom = this.zoom();
      const mode = this.mode();
      if (!this.doc) return;
      if (mode === 'page') {
        this.scrollSetupKey = null;
        void this.renderSinglePage(page, zoom);
        return;
      }
      const key = `${mode}:${zoom}`;
      if (key !== this.scrollSetupKey) {
        // Cambió el zoom o el modo: reconstruir las páginas
        this.scrollSetupKey = key;
        void this.setupScrollMode(zoom, page);
      } else if (page !== this.observerPage) {
        // Cambió la página desde la barra o el teclado: solo desplazar
        this.scrollToPage(page);
      }
    });

    this.destroyRef.onDestroy(() => {
      this.renderTask?.cancel();
      this.detachScrollTracking();
      this.resizeObserver?.disconnect();
      if (this.resizeTimer) clearTimeout(this.resizeTimer);
      // En pdf.js v6 el ciclo de vida lo gestiona la tarea de carga
      void this.loadingTask?.destroy();
    });
  }

  private async load(): Promise<void> {
    try {
      const pdfjs = await import('pdfjs-dist');
      pdfjs.GlobalWorkerOptions.workerSrc = '/assets/pdfjs/pdf.worker.min.mjs';
      // pdf.js transfiere el buffer al worker: pasamos una copia para poder reutilizar el original
      this.loadingTask = pdfjs.getDocument({ data: this.data().slice(0) });
      this.doc = await this.loadingTask.promise;
      this.totalPages.emit(this.doc.numPages);
      this.ready.set(true);
      this.loaded.emit();
      void this.loadOutline();

      const el = this.container().nativeElement;
      this.lastWidth = el.clientWidth;
      this.lastHeight = el.clientHeight;
      this.resizeObserver = new ResizeObserver(() => {
        // Ancho y alto (en modo página la página entera se ajusta al panel); con debounce
        const { clientWidth: width, clientHeight: height } = el;
        if (Math.abs(width - this.lastWidth) < 4 && Math.abs(height - this.lastHeight) < 4) return;
        this.lastWidth = width;
        this.lastHeight = height;
        if (this.resizeTimer) clearTimeout(this.resizeTimer);
        this.resizeTimer = setTimeout(() => this.zone.run(() => this.rerender()), 150);
      });
      this.resizeObserver.observe(this.container().nativeElement);

      if (this.mode() === 'page') {
        await this.renderSinglePage(this.page(), this.zoom());
      } else {
        this.scrollSetupKey = `${this.mode()}:${this.zoom()}`;
        await this.setupScrollMode(this.zoom(), this.page());
      }
    } catch (e) {
      console.error(e);
      this.error.set('No se pudo abrir el PDF');
    }
  }

  /**
   * Resuelve el índice del PDF a números de página. Cada entrada apunta a un
   * "destino" (explícito o con nombre) cuyo primer elemento es la referencia
   * de la página; pdf.js la traduce a índice.
   */
  private async loadOutline(): Promise<void> {
    if (!this.doc) return;
    try {
      const outline = await this.doc.getOutline();
      if (!outline?.length) return;
      const chapters: PdfChapter[] = [];
      for (const item of outline) {
        const dest = typeof item.dest === 'string' ? await this.doc.getDestination(item.dest) : item.dest;
        const ref = dest?.[0];
        if (!ref || typeof ref !== 'object') continue;
        const index = await this.doc.getPageIndex(ref);
        chapters.push({ title: item.title, page: index + 1 });
      }
      chapters.sort((a, b) => a.page - b.page);
      this.outlineLoaded.emit(chapters);
    } catch {
      // Sin índice utilizable: el lector muestra solo página X de N
    }
  }

  /** El contenedor cambió de tamaño (giro del móvil, ventana): reajustar al ancho. */
  private rerender(): void {
    if (!this.doc || !this.ready()) return;
    if (this.mode() === 'page') {
      void this.renderSinglePage(this.page(), this.zoom());
    } else {
      this.scrollSetupKey = `${this.mode()}:${this.zoom()}`;
      void this.setupScrollMode(this.zoom(), this.page());
    }
  }

  private scrollToPage(pageNumber: number): void {
    const target = this.container().nativeElement.querySelector<HTMLCanvasElement>(
      `canvas[data-page="${pageNumber}"]`
    );
    if (!target) return;
    this.suppressPageEmit = true;
    target.scrollIntoView({ block: 'start' });
    setTimeout(() => (this.suppressPageEmit = false), 300);
  }

  /**
   * Escala de ajuste. En modo página la página completa cabe en el panel
   * (ancho y alto, como en Apple Books); en modo scroll se ajusta al ancho.
   */
  private async fitScale(pageNumber: number, zoom: number, fit: 'width' | 'page' = 'width'): Promise<number> {
    const page = await this.doc!.getPage(pageNumber);
    const base = page.getViewport({ scale: 1 });
    const el = this.container().nativeElement;
    const availableWidth = Math.max(200, el.clientWidth - 32);
    const byWidth = availableWidth / base.width;
    if (fit === 'width') {
      return byWidth * zoom;
    }
    const availableHeight = Math.max(200, el.clientHeight - 32);
    return Math.min(byWidth, availableHeight / base.height) * zoom;
  }

  private async renderSinglePage(pageNumber: number, zoom: number): Promise<void> {
    const canvas = this.pageCanvas()?.nativeElement;
    if (!this.doc || !canvas) return;
    const safePage = Math.min(Math.max(1, pageNumber), this.doc.numPages);
    const scale = await this.fitScale(safePage, zoom, 'page');
    await this.renderInto(safePage, canvas, scale);
    this.container().nativeElement.scrollTop = 0;
  }

  /**
   * Prepara el modo scroll: calcula la escala y reserva el espacio de las
   * páginas. El seguimiento se engancha en {@link attachScrollTracking} cuando
   * Angular ya ha pintado los canvas (afterRenderEffect sobre viewChildren).
   */
  private async setupScrollMode(zoom: number, currentPage: number): Promise<void> {
    if (!this.doc) return;
    const version = ++this.setupVersion;
    this.detachScrollTracking();
    this.rendered = new Set();
    // Sin escala no se engancha el seguimiento: evita montajes con la escala anterior
    this.scrollScale.set(null);
    const scale = await this.fitScale(1, zoom);
    if (version !== this.setupVersion) return; // otro montaje más reciente tomó el relevo
    const first = await this.doc.getPage(1);
    const viewport = first.getViewport({ scale });
    this.pendingScrollPage = Math.min(Math.max(1, currentPage), this.doc.numPages);
    this.pageSize.set({ width: Math.floor(viewport.width), height: Math.floor(viewport.height) });
    this.pageNumbers.set(Array.from({ length: this.doc.numPages }, (_, i) => i + 1));
    this.scrollScale.set(scale);
    this.scrollReady.update((v) => v + 1);
  }

  /**
   * Seguimiento del scroll con geometría explícita (en lugar de
   * IntersectionObserver, que depende de frames de render): renderiza las
   * páginas cercanas al viewport y marca como actual la más visible.
   */
  private attachScrollTracking(canvases: readonly HTMLCanvasElement[], scale: number): void {
    this.detachScrollTracking();
    const version = this.setupVersion;
    this.rendered = new Set();
    const container = this.container().nativeElement;

    const update = () => {
      if (version !== this.setupVersion) return;
      const viewTop = container.scrollTop;
      const viewBottom = viewTop + container.clientHeight;
      let best: { page: number; visible: number } | null = null;
      for (const canvas of canvases) {
        const n = Number(canvas.dataset['page']);
        const top = canvas.offsetTop;
        const bottom = top + canvas.offsetHeight;
        // Renderizar con un margen de 200px alrededor del viewport
        if (bottom > viewTop - 200 && top < viewBottom + 200 && !this.rendered.has(n)) {
          this.rendered.add(n);
          void this.renderInto(n, canvas, scale);
        }
        const visible = Math.max(0, Math.min(bottom, viewBottom) - Math.max(top, viewTop));
        if (visible > 0 && (!best || visible > best.visible)) {
          best = { page: n, visible };
        }
      }
      if (best && !this.suppressPageEmit && best.page !== this.page()) {
        this.observerPage = best.page;
        this.zone.run(() => this.page.set(best!.page));
      }
    };

    this.scrollListener = () => {
      if (this.scrollTimer) return;
      this.scrollTimer = setTimeout(() => {
        this.scrollTimer = null;
        update();
      }, 80);
    };
    this.zone.runOutsideAngular(() =>
      container.addEventListener('scroll', this.scrollListener!, { passive: true })
    );

    // Colocar la vista en la página actual sin que el seguimiento la sobrescriba
    const target = this.pendingScrollPage ?? this.page();
    this.pendingScrollPage = null;
    this.observerPage = target;
    this.scrollToPage(target);
    update();
  }

  private detachScrollTracking(): void {
    if (this.scrollListener) {
      this.container().nativeElement.removeEventListener('scroll', this.scrollListener);
      this.scrollListener = null;
    }
    if (this.scrollTimer) {
      clearTimeout(this.scrollTimer);
      this.scrollTimer = null;
    }
  }

  private async renderInto(pageNumber: number, canvas: HTMLCanvasElement, scale: number): Promise<void> {
    if (!this.doc) return;
    const page = await this.doc.getPage(pageNumber);
    const dpr = window.devicePixelRatio || 1;
    const viewport = page.getViewport({ scale });
    canvas.width = Math.floor(viewport.width * dpr);
    canvas.height = Math.floor(viewport.height * dpr);
    canvas.style.width = `${Math.floor(viewport.width)}px`;
    canvas.style.height = `${Math.floor(viewport.height)}px`;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (this.mode() === 'page') {
      this.renderTask?.cancel();
    }
    const task = page.render({ canvas, canvasContext: context, viewport });
    if (this.mode() === 'page') {
      this.renderTask = task;
    }
    try {
      await task.promise;
    } catch (e: unknown) {
      // Cancelaciones al cambiar de página rápidamente son esperables
      if (!(e instanceof Error && e.name === 'RenderingCancelledException')) {
        console.error(e);
      }
    }
  }

  // --- gestos táctiles (modo página) ---

  onTouchStart(event: TouchEvent): void {
    this.touchStartX = event.changedTouches[0]?.clientX ?? 0;
  }

  onTouchEnd(event: TouchEvent): void {
    if (this.mode() !== 'page' || !this.doc) return;
    const delta = (event.changedTouches[0]?.clientX ?? 0) - this.touchStartX;
    if (Math.abs(delta) < 60) return;
    const next = delta < 0 ? this.page() + 1 : this.page() - 1;
    if (next >= 1 && next <= this.doc.numPages) {
      this.page.set(next);
    }
  }
}

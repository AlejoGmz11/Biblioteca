import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { environment } from '../../../environments/environment';

export interface SeoConfig {
  title: string;
  description?: string;
  ogImage?: string | null;
  path?: string;
}

/** Dynamic titles, meta descriptions, Open Graph tags and document language. */
@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly document = inject(DOCUMENT);

  apply(config: SeoConfig): void {
    this.title.setTitle(config.title);
    this.meta.updateTag({ property: 'og:title', content: config.title });

    if (config.description) {
      this.meta.updateTag({ name: 'description', content: config.description });
      this.meta.updateTag({ property: 'og:description', content: config.description });
    }
    if (config.ogImage) {
      this.meta.updateTag({ property: 'og:image', content: config.ogImage });
    }
    if (config.path !== undefined) {
      this.meta.updateTag({ property: 'og:url', content: `${environment.siteUrl}${config.path}` });
    }
  }

  setLanguage(lang: string): void {
    this.document.documentElement.lang = lang;
  }

  /** Injects (or replaces) a Schema.org JSON-LD block, e.g. type Book. */
  setJsonLd(schema: object | null): void {
    const id = 'seo-json-ld';
    this.document.getElementById(id)?.remove();
    if (!schema) {
      return;
    }
    const script = this.document.createElement('script');
    script.id = id;
    script.type = 'application/ld+json';
    script.text = JSON.stringify(schema);
    this.document.head.appendChild(script);
  }
}

import { Injectable, computed, inject, signal } from '@angular/core';
import { ApiService } from './api.service';

export interface QuickTag {
  id: number;
  label: string;
  query: string;
  sortOrder: number;
  isActive: boolean;
}

/**
 * The wording and shortcuts the shop owner controls from the admin site.
 *
 * Both are fetched once per visit and held in signals, so every component
 * reading them shares one request. They change rarely — a shop renames a tag
 * now and then — and re-requesting per component would be a lot of traffic for
 * data that is almost always identical.
 *
 * Defaults are baked in and used until the response lands. Without them the
 * header would render an empty tag row and the home page an empty heading for
 * the first few hundred milliseconds, which reads as a broken site rather than
 * a loading one.
 */
@Injectable({ providedIn: 'root' })
export class StoreContentService {
  private readonly api = inject(ApiService);

  private readonly tagList = signal<QuickTag[]>(FALLBACK_TAGS);
  private readonly textMap = signal<Record<string, string>>(FALLBACK_TEXT);

  readonly tags = this.tagList.asReadonly();

  /** Labels only, for anything that just wants the words. */
  readonly tagLabels = computed(() => this.tagList().map((tag) => tag.label));

  private loaded = false;

  /**
   * One string, by key.
   *
   * Falls back to the built-in default rather than returning undefined, so a
   * key the API has not heard of never renders as the word "undefined".
   */
  text(key: string): string {
    return this.textMap()[key] ?? FALLBACK_TEXT[key] ?? '';
  }

  /** Loads once. A failure clears the flag so the next caller can retry. */
  load(): void {
    if (this.loaded) return;
    this.loaded = true;

    this.api.get<QuickTag[]>('store/tags').subscribe({
      next: (tags) => {
        // An empty list is ignored: a shop with no tags configured should
        // show the defaults rather than an empty strip.
        if (tags.length > 0) this.tagList.set(tags);
      },
      error: () => {
        this.loaded = false;
      },
    });

    this.api.get<Record<string, string>>('store/text').subscribe({
      next: (text) => this.textMap.set({ ...FALLBACK_TEXT, ...text }),
    });
  }
}

const FALLBACK_TAGS: QuickTag[] = [
  { id: 0, label: 'iPhone', query: 'iphone', sortOrder: 1, isActive: true },
  { id: 0, label: 'ThinkPad', query: 'thinkpad', sortOrder: 2, isActive: true },
  { id: 0, label: 'Apple Watch', query: 'apple watch', sortOrder: 3, isActive: true },
  { id: 0, label: 'Xiaomi', query: 'xiaomi', sortOrder: 4, isActive: true },
  { id: 0, label: 'Mouse', query: 'mouse', sortOrder: 5, isActive: true },
  { id: 0, label: 'Under $100', query: 'under 100', sortOrder: 6, isActive: true },
];

const FALLBACK_TEXT: Record<string, string> = {
  'shop.name': 'LoottaTech',
  'hero.headline': 'Second-hand tech, honestly described',
  'hero.subtitle': 'Every item tested, photographed and graded before it is listed.',
  'hero.cta': 'Browse the shop',
  'trust.one': 'Tested before listing',
  'trust.two': 'Photos of every flaw',
  'trust.three': 'Warranty on most items',
  'footer.note': 'A student project by LoottaTech. Prices are demonstration data.',
};

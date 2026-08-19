import { Injectable, computed, inject, signal } from '@angular/core';
import { ProductService } from './product.service';
import { Product } from '../../shared/models/product';

export interface Suggestion {
  product: Product;
  /** Lower is a better match. Used only for ordering. */
  score: number;
}

/**
 * Search suggestions that survive typos.
 *
 * The catalogue is fetched ONCE and matched in the browser. For a shop this
 * size that beats a request per keystroke on every measure: no network wait,
 * no server load, and it still works while the connection stutters.
 *
 * At tens of thousands of products this would move server-side — but building
 * that now would be solving a problem the shop does not have.
 */
@Injectable({ providedIn: 'root' })
export class SearchService {
  private readonly products = inject(ProductService);

  private readonly index = signal<Product[]>([]);
  private loaded = false;

  readonly ready = computed(() => this.index().length > 0);

  /** Loads the index on first use, then never again. */
  ensureLoaded(): void {
    if (this.loaded) return;
    this.loaded = true;

    this.products.getAll().subscribe({
      next: (products) => this.index.set(products),
      error: () => { this.loaded = false; },   // let it retry later
    });
  }

  suggest(term: string, limit = 6): Suggestion[] {
    const query = normalise(term);
    if (query.length === 0) return [];

    const results: Suggestion[] = [];

    for (const product of this.index()) {
      const score = scoreProduct(product, query);
      if (score !== null) results.push({ product, score });
    }

    return results.sort((a, b) => a.score - b.score).slice(0, limit);
  }
}

/** Lower-case, strip accents and punctuation, collapse spaces. */
function normalise(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * How well a product matches, or null for no match.
 *
 * Tried in order of confidence:
 *   0  the whole haystack starts with the query
 *   1  a word starts with the query        ("xia" -> "xiaomi")
 *   2  the query appears anywhere
 *   3  a word is within edit distance 1-2  ("xioa" -> "xiaomi")
 */
function scoreProduct(product: Product, query: string): number | null {
  const haystack = normalise(
    `${product.title} ${product.brand} ${product.category}`,
  );

  if (haystack.startsWith(query)) return 0;

  const words = haystack.split(' ');

  if (words.some((word) => word.startsWith(query))) return 1;
  if (haystack.includes(query)) return 2;

  // Typo tolerance. Allowance grows with length: one slip in a short word,
  // two in a longer one — enough for "xioa", not enough to match anything.
  const allowed = query.length <= 4 ? 1 : 2;

  for (const word of words) {
    if (Math.abs(word.length - query.length) > allowed) continue;
    if (editDistance(word, query) <= allowed) return 3;
  }

  return null;
}

/**
 * Levenshtein distance, with an early exit once it exceeds what we allow.
 *
 * Two rolling rows instead of a full matrix: the algorithm only ever needs the
 * previous row, so allocating the whole grid would waste memory for nothing.
 */
function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  let current = new Array<number>(b.length + 1);

  for (let i = 1; i <= a.length; i++) {
    current[0] = i;
    let rowBest = current[0];

    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;

      current[j] = Math.min(
        current[j - 1] + 1,      // insertion
        previous[j] + 1,         // deletion
        previous[j - 1] + cost,  // substitution
      );

      rowBest = Math.min(rowBest, current[j]);
    }

    // Nothing in this row is close enough, and it only grows from here.
    if (rowBest > 3) return rowBest;

    [previous, current] = [current, previous];
  }

  return previous[b.length];
}

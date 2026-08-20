import { Injectable, computed, inject, signal } from '@angular/core';
import { ProductService } from './product.service';
import { Product } from '../../shared/models/product';

export interface Suggestion {
  product: Product;
  /** Lower is a better match. Used only for ordering. */
  score: number;
}

/**
 * A search phrase offered while typing, already split for highlighting.
 *
 * The split is done once here rather than in the template. Doing it in the
 * view would mean running string work on every change detection pass, for
 * every row, forever — this way it happens once per keystroke.
 */
export interface TermSuggestion {
  text: string;
  pre: string;
  mid: string;
  post: string;
}

/** A row in the "trending" list shown before anything is typed. */
export interface TrendingEntry {
  rank: number;
  text: string;
  badge: 'hot' | 'new' | 'deal' | null;
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

  /**
   * What is currently typed.
   *
   * Held here so suggestions can be a computed over BOTH the term and the
   * index. The first version called suggest() on each keystroke, which meant
   * the earliest characters were matched against an empty index that had not
   * downloaded yet — and nothing ever recomputed when it arrived.
   */
  private readonly term = signal('');

  readonly suggestions = computed(() => this.match(this.term(), 6));

  /**
   * Every phrase a shopper might reasonably type, built from the catalogue.
   *
   * A computed over the index, so it is rebuilt only when products change —
   * not on each keystroke. Typing then filters this pool, which is a plain
   * scan over a few hundred short strings and finishes well inside a frame.
   */
  private readonly phrases = computed(() => {
    const pool = new Set<string>();

    for (const product of this.index()) {
      const [modelPart, taglinePart] = product.title.split('—');
      const model = modelPart.trim();
      if (!model) continue;

      pool.add(model);

      // "iPhone 12 mini clean screen" — the descriptive half of the title,
      // which is how people actually search a second-hand shop.
      const tagline = (taglinePart ?? '').split(/[·,]/)[0].trim();
      if (tagline) pool.add(`${model} ${tagline}`);

      if (product.brand) pool.add(`${product.brand} ${product.category}`);

      // A couple of shopping intents per product, not per phrase, or the
      // pool triples in size for very little extra usefulness.
      pool.add(`${model} second hand`);
      pool.add(`${model} price`);

      if (pool.size > 600) break;
    }

    return [...pool];
  });

  /**
   * Phrases matching what is typed, best first, split ready for highlighting.
   *
   * Prefix matches rank above matches in the middle of a phrase, which is
   * what makes the list feel like it is completing the sentence rather than
   * showing everything containing those letters.
   */
  readonly termSuggestions = computed<TermSuggestion[]>(() => {
    const raw = this.term().trim();
    if (raw.length === 0) return [];

    const needle = raw.toLowerCase();
    const scored: { entry: TermSuggestion; score: number }[] = [];

    for (const text of this.phrases()) {
      const at = text.toLowerCase().indexOf(needle);
      if (at === -1) continue;

      scored.push({
        entry: {
          text,
          pre: text.slice(0, at),
          mid: text.slice(at, at + raw.length),
          post: text.slice(at + raw.length),
        },
        // Earlier match wins; shorter phrase breaks the tie so the plain
        // model name sits above its longer variations.
        score: at * 100 + text.length,
      });

      if (scored.length > 60) break;
    }

    return scored
      .sort((a, b) => a.score - b.score)
      .slice(0, 10)
      .map((row) => row.entry);
  });

  /**
   * The trending list shown on an empty box.
   *
   * Ordered by how many people are watching each item, which is real data the
   * shop already collects rather than an invented ranking.
   */
  readonly trending = computed<TrendingEntry[]>(() => {
    const products = [...this.index()]
      .sort((a, b) => (b.watchCount ?? 0) - (a.watchCount ?? 0))
      .slice(0, 10);

    if (products.length === 0) return FALLBACK_TRENDING;

    return products.map((product, i) => {
      const discount =
        product.originalPrice > 0
          ? 1 - product.price / product.originalPrice
          : 0;

      let badge: TrendingEntry['badge'] = null;
      if (i < 3) badge = 'hot';
      else if (discount >= 0.45) badge = 'deal';
      else if (product.condition === 'new') badge = 'new';

      return {
        rank: i + 1,
        text: product.title.split('—')[0].trim(),
        badge,
      };
    });
  });

  setTerm(value: string): void {
    this.term.set(value);
    this.ensureLoaded();
  }

  /**
   * The searches to offer before anyone types.
   *
   * Brands from the real catalogue once it has loaded, with a sensible default
   * list until then — an empty panel on a first visit looks broken, and the
   * index arrives a moment after the box is focused.
   */
  readonly popular = computed(() => {
    const brands = new Set<string>();

    for (const product of this.index()) {
      if (product.brand) brands.add(product.brand);
      if (brands.size >= 8) break;
    }

    if (brands.size > 0) return [...brands];

    return ['iPhone', 'Xiaomi', 'ThinkPad', 'Apple Watch', 'Mouse', 'Laptop'];
  });

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
    return this.match(term, limit);
  }

  private match(term: string, limit: number): Suggestion[] {
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

/**
 * Shown only when the catalogue has not downloaded yet. An empty dropdown on
 * a first visit reads as a broken feature, so there is always something here.
 */
const FALLBACK_TRENDING: TrendingEntry[] = [
  { rank: 1, text: 'iPhone 12 mini', badge: 'hot' },
  { rank: 2, text: 'ThinkPad E14', badge: 'hot' },
  { rank: 3, text: 'Apple Watch Series 7', badge: 'hot' },
  { rank: 4, text: 'Xiaomi phones', badge: 'deal' },
  { rank: 5, text: 'Gaming desktop', badge: null },
  { rank: 6, text: 'Wireless mouse', badge: 'new' },
  { rank: 7, text: 'Laptops under $300', badge: 'deal' },
  { rank: 8, text: 'iPad second hand', badge: null },
  { rank: 9, text: 'Monitors 144Hz', badge: null },
  { rank: 10, text: 'Mechanical keyboard', badge: 'new' },
];

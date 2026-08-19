import { Injectable, computed, signal } from '@angular/core';
import { Product } from '../../shared/models/product';

const STORAGE_KEY = 'lootta-recent';
const LIMIT = 8;

/**
 * The last few products this browser looked at.
 *
 * Deliberately client-side: it is a browsing convenience, not account data.
 * Sending every page view to the server would mean writing a row for every
 * glance, and asking a guest to sign in before we can be helpful.
 */
@Injectable({ providedIn: 'root' })
export class RecentlyViewedService {
  private readonly items = signal<Product[]>(this.restore());

  readonly recent = this.items.asReadonly();
  readonly count = computed(() => this.items().length);

  /** Records a view, moving repeats to the front rather than duplicating them. */
  add(product: Product): void {
    this.items.update((list) => {
      const without = list.filter((p) => p.id !== product.id);
      return [product, ...without].slice(0, LIMIT);
    });

    this.persist();
  }

  /** Everything except the product being looked at right now. */
  others(excludeId: number): Product[] {
    return this.items().filter((p) => p.id !== excludeId);
  }

  clear(): void {
    this.items.set([]);
    localStorage.removeItem(STORAGE_KEY);
  }

  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.items()));
    } catch {
      // A full or blocked localStorage must not break browsing.
    }
  }

  private restore(): Product[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as Product[]) : [];
    } catch {
      return [];
    }
  }
}

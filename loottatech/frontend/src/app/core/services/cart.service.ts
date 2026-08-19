import { Injectable, computed, effect, signal } from '@angular/core';
import { Product } from '../../shared/models/product';

export interface CartLine {
  product: Product;
  quantity: number;
}

const STORAGE_KEY = 'lootta-cart';

/**
 * Cart state as signals.
 *
 * `lines` is the one writable source of truth; `count` and `total` are
 * `computed`, so they can never disagree with it. Any component that reads
 * `cart.count()` updates the moment a line changes — no subscriptions, no
 * manual change detection.
 */
@Injectable({ providedIn: 'root' })
export class CartService {
  /**
   * A single product being bought on its own, bypassing the cart.
   *
   * Kept separate from the cart rather than clearing it: someone who hits
   * "Buy now" on a charger should not lose the laptop they were still
   * deciding about. Checkout reads this when it is set, the cart when it
   * is not, and nothing else has to know the difference.
   */
  private readonly direct = signal<CartLine | null>(null);
  readonly directBuy = this.direct.asReadonly();

  private readonly lines = signal<CartLine[]>(this.restore());

  readonly items = this.lines.asReadonly();

  readonly count = computed(() => this.lines().reduce((sum, l) => sum + l.quantity, 0));

  readonly total = computed(() =>
    this.lines().reduce((sum, l) => sum + l.product.price * l.quantity, 0),
  );

  constructor() {
    effect(() => localStorage.setItem(STORAGE_KEY, JSON.stringify(this.lines())));
  }

  add(product: Product, quantity = 1): void {
    this.lines.update((lines) => {
      const existing = lines.find((l) => l.product.id === product.id);
      if (existing) {
        return lines.map((l) =>
          l.product.id === product.id
            ? { ...l, quantity: Math.min(l.quantity + quantity, product.stock) }
            : l,
        );
      }
      return [...lines, { product, quantity }];
    });
  }

  setQuantity(productId: number, quantity: number): void {
    if (quantity <= 0) return this.remove(productId);
    this.lines.update((lines) =>
      lines.map((l) => (l.product.id === productId ? { ...l, quantity } : l)),
    );
  }

  remove(productId: number): void {
    this.lines.update((lines) => lines.filter((l) => l.product.id !== productId));
  }

  clear(): void {
    this.lines.set([]);
  }

  private restore(): CartLine[] {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as CartLine[];
    } catch {
      return [];
    }
  }

  /** Start a one-item purchase. Does not touch the cart. */
  buyNow(product: Product, quantity = 1): void {
    this.direct.set({ product, quantity });
  }

  clearDirectBuy(): void {
    this.direct.set(null);
  }

  /** What checkout should actually charge for. */
  linesForCheckout(): CartLine[] {
    const single = this.direct();
    return single ? [single] : this.items();
  }
}

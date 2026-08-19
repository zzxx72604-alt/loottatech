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

  /**
   * A small dot that arcs from wherever the button was to the cart icon.
   *
   * Written with the Web Animations API rather than a component: it is purely
   * decorative, lives for 600ms, and should never cause a re-render. The
   * element removes itself, so nothing is left in the DOM or in memory.
   */
  flyToCart(from: DOMRect): void {
    if (typeof document === 'undefined') return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const target = document.querySelector('[data-cart-icon]')?.getBoundingClientRect();
    if (!target) return;

    const dot = document.createElement('span');
    dot.className = 'cart-fly-dot';
    dot.style.cssText = `
      position: fixed;
      left: ${from.left + from.width / 2}px;
      top: ${from.top + from.height / 2}px;
      width: 14px; height: 14px; margin: -7px 0 0 -7px;
      border-radius: 50%;
      background: var(--price, #ff4e00);
      pointer-events: none;
      z-index: 400;
    `;

    document.body.appendChild(dot);

    const dx = target.left + target.width / 2 - (from.left + from.width / 2);
    const dy = target.top + target.height / 2 - (from.top + from.height / 2);

    const animation = dot.animate(
      [
        { transform: 'translate(0, 0) scale(1)', opacity: 1 },
        { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 60}px) scale(1.15)`, opacity: 1, offset: 0.55 },
        { transform: `translate(${dx}px, ${dy}px) scale(0.3)`, opacity: 0.2 },
      ],
      { duration: 620, easing: 'cubic-bezier(.4, 0, .2, 1)' },
    );

    animation.onfinish = () => dot.remove();
  }
}

import { Router } from '@angular/router';
import { ChangeDetectionStrategy, Component, Input, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { NgOptimizedImage } from '@angular/common';
import { ProductService } from '../../core/services/product.service';
import { CartService } from '../../core/services/cart.service';
import { ToastService } from '../../core/services/toast.service';
import { ProductCard } from '../../shared/components/product-card/product-card';
import { ProductCardSkeleton } from '../../shared/components/product-card-skeleton/product-card-skeleton';
import { AdTile, Promo } from '../../shared/components/ad-tile/ad-tile';
import { Condition, Product, discountPercent } from '../../shared/models/product';

type SortMode = 'recommended' | 'price-asc' | 'price-desc' | 'discount';

interface CategoryCount {
  name: string;
  count: number;
}

@Component({
  selector: 'app-catalog',
  imports: [FormsModule, NgOptimizedImage, ProductCard, ProductCardSkeleton, AdTile],
  templateUrl: './catalog.html',
  styleUrl: './catalog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Catalog {
  private readonly productService = inject(ProductService);
  private readonly cart = inject(CartService);
  private readonly router = inject(Router);
  private readonly toasts = inject(ToastService);

  /* ----------------------------------------------------------- data ----- */

  protected readonly products = signal<Product[]>([]);
  protected readonly loading = signal(true);
  protected readonly failed = signal(false);

  /* -------------------------------------------------------- filters ----- */

  /** Bound from the /search/:term route by withComponentInputBinding(). */
  @Input() set term(value: string) {
    this.searchTerm.set(value ?? '');
  }
  protected readonly searchTerm = signal('');

  protected readonly category = signal('All');
  protected readonly condition = signal<Condition | 'all'>('all');
  protected readonly maxPrice = signal<number | null>(null);
  protected readonly sort = signal<SortMode>('recommended');

  protected readonly conditionChips: { value: Condition | 'all'; label: string }[] = [
    { value: 'all', label: 'Any condition' },
    { value: 'new', label: 'Brand new' },
    { value: 'like-new', label: 'Almost new' },
    { value: 'good', label: 'Good' },
    { value: 'fair', label: 'Fair' },
  ];

  protected readonly priceChips: { value: number | null; label: string }[] = [
    { value: null, label: 'Any price' },
    { value: 50, label: 'Under $50' },
    { value: 200, label: 'Under $200' },
    { value: 300, label: 'Under $300' },
  ];

  protected readonly sortOptions: { value: SortMode; label: string }[] = [
    { value: 'recommended', label: 'Recommended' },
    { value: 'price-asc', label: 'Price: low to high' },
    { value: 'price-desc', label: 'Price: high to low' },
    { value: 'discount', label: 'Biggest discount' },
  ];

  /* ------------------------------------------------------- computed ----- */

  /** Categories are derived from the products we already have — no extra API call. */
  protected readonly categories = computed<CategoryCount[]>(() => {
    const counts = new Map<string, number>();
    for (const p of this.products()) {
      counts.set(p.category, (counts.get(p.category) ?? 0) + 1);
    }
    return [
      { name: 'All', count: this.products().length },
      ...[...counts.entries()]
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count),
    ];
  });

  /**
   * The visible list. Every filter and the sort are applied here, in one place.
   * Because it's a `computed`, it only recalculates when something it reads
   * actually changes — clicking a chip never re-runs the HTTP call.
   */
  protected readonly visible = computed<Product[]>(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const cat = this.category();
    const cond = this.condition();
    const max = this.maxPrice();

    let list = this.products().filter((p) => {
      if (cat !== 'All' && p.category !== cat) return false;
      if (cond !== 'all' && p.condition !== cond) return false;
      if (max !== null && p.price > max) return false;
      if (term) {
        const haystack = `${p.title} ${p.brand} ${p.category}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });

    switch (this.sort()) {
      case 'price-asc':
        list = [...list].sort((a, b) => a.price - b.price);
        break;
      case 'price-desc':
        list = [...list].sort((a, b) => b.price - a.price);
        break;
      case 'discount':
        list = [...list].sort((a, b) => discountPercent(b) - discountPercent(a));
        break;
    }
    return list;
  });

  /** Biggest savings first — drives the "Best deals" strip. */
  protected readonly bestDeals = computed(() =>
    [...this.products()]
      .filter((p) => discountPercent(p) > 0)
      .sort((a, b) => discountPercent(b) - discountPercent(a))
      .slice(0, 5),
  );

  /** Newest arrivals — the API returns newest first. */
  protected readonly newArrivals = computed(() => this.products().slice(0, 5));

  /** True only on the plain homepage, so search results stay uncluttered. */
  protected readonly showSections = computed(
    () => !this.hasFilters() && this.products().length > 0,
  );

  protected readonly categoryIcons: Record<string, string> = {
    Phones: '📱',
    Laptops: '💻',
    Tablets: '📋',
    Monitors: '🖥️',
    Printers: '🖨️',
    'PC Parts': '🧩',
    Wearables: '⌚',
    Gaming: '🎮',
    Accessories: '🖱️',
    Drones: '🚁',
  };

  protected icon(name: string): string {
    return this.categoryIcons[name] ?? '📦';
  }

  /**
   * Promo tiles mixed into the grid, the way marketplace apps place adverts
   * between listings. Pure CSS, so they cost no download and never shift the
   * layout while loading.
   */
  protected readonly promos: Promo[] = [
    {
      title: 'Play. Win. Save.',
      line: 'Every order earns coins. Spend them in the arcade for real discounts.',
      cta: 'Open the arcade',
      link: '/arcade',
      theme: 'brand',
    },
    {
      title: 'Every flaw, photographed',
      line: "We show the scratches. If it isn't in the photos, it isn't on the item.",
      cta: 'How we grade',
      link: '/',
      theme: 'dark',
    },
    {
      title: 'Under $100',
      line: 'Working tech that costs less than a night out.',
      cta: 'See the cheap shelf',
      link: '/search/under',
      theme: 'sale',
    },
  ];

  /**
   * The grid, with a promo tile injected every 7 products.
   *
   * Built as one list so CSS Grid handles the layout — the alternative,
   * separate rows of products and ads, breaks the moment the column count
   * changes at a breakpoint.
   */
  protected readonly feed = computed(() => {
    const products = this.visible();
    const items: ({ kind: 'product'; product: Product } | { kind: 'ad'; promo: Promo })[] = [];

    products.forEach((product, index) => {
      items.push({ kind: 'product', product });

      const slot = Math.floor(index / 7);
      if ((index + 1) % 7 === 0 && slot < this.promos.length) {
        items.push({ kind: 'ad', promo: this.promos[slot] });
      }
    });

    return items;
  });

  protected readonly trustPoints = [
    { icon: '🔍', title: 'Quality checked', note: 'Every used item is tested' },
    { icon: '📷', title: 'Honest photos', note: 'We photograph the scratches too' },
    { icon: '🛡️', title: 'Warranty included', note: 'Up to 12 months, stated per item' },
    { icon: '🏪', title: 'Local shop', note: 'Phnom Penh, pickup available' },
  ];

  protected readonly hasFilters = computed(
    () =>
      this.category() !== 'All' ||
      this.condition() !== 'all' ||
      this.maxPrice() !== null ||
      this.searchTerm() !== '',
  );

  /* ---------------------------------------------------------- setup ----- */

  constructor() {
    this.productService
      .getAll()
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: (products) => {
          this.products.set(products);
          this.loading.set(false);
        },
        error: () => {
          this.failed.set(true);
          this.loading.set(false);
        },
      });
  }

  /* -------------------------------------------------------- actions ----- */

  /** Handles the @Output coming up from ProductCard. */
  protected onAddToCart(product: Product): void {
    this.cart.add(product);
    this.toasts.success(`${product.title} added to your cart`, {
      label: 'View cart',
      link: '/cart',
    });
  }

  protected onToggleWatch(product: Product): void {
    // Day 3 will persist this; for now it's a local nudge.
    this.products.update((list) =>
      list.map((p) => (p.id === product.id ? { ...p, watchCount: p.watchCount + 1 } : p)),
    );
  }

  protected clearFilters(): void {
    this.category.set('All');
    this.condition.set('all');
    this.maxPrice.set(null);
    this.searchTerm.set('');
  }

  protected trackById(_index: number, product: Product): number {
    return product.id;
  }

  /**
   * Buy one item straight from a card.
   *
   * With a cart already holding things, the detail page asks first. From a
   * card we send the customer to the product instead, so the choice is made
   * on the page that shows what they are actually buying.
   */
  protected onBuyNow(product: Product): void {
    if (this.cart.items().length > 0) {
      this.router.navigate(['/product', product.id], { queryParams: { buy: 1 } });
      return;
    }

    this.cart.buyNow(product);
    this.router.navigate(['/checkout']);
  }
}

import { Router } from '@angular/router';
import {
  ChangeDetectionStrategy,
  Component,
  Input,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { NgOptimizedImage } from '@angular/common';
import { ProductService } from '../../core/services/product.service';
import { CartService } from '../../core/services/cart.service';
import { ToastService } from '../../core/services/toast.service';
import { ProductCard } from '../../shared/components/product-card/product-card';
import { ProductCardSkeleton } from '../../shared/components/product-card-skeleton/product-card-skeleton';
import { AdTile, Promo } from '../../shared/components/ad-tile/ad-tile';
import { IntersectDirective } from '../../shared/directives/intersect.directive';
import { ScrollStrip } from '../../shared/components/scroll-strip/scroll-strip';
import { Condition, Product, discountPercent } from '../../shared/models/product';

type SortMode = 'recommended' | 'price-asc' | 'price-desc' | 'discount';

interface CategoryCount {
  name: string;
  count: number;
}

@Component({
  selector: 'app-catalog',
  imports: [FormsModule, NgOptimizedImage, ProductCard, ProductCardSkeleton, AdTile, IntersectDirective, ScrollStrip],
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

  /* ------------------------------------------------------ endless scroll */

  /** How many arrive per request. Small enough to feel instant. */
  private readonly PAGE_SIZE = 24;

  protected readonly total = signal(0);
  protected readonly hasMore = signal(false);
  protected readonly loadingMore = signal(false);

  /**
   * Bumped whenever a filter changes, so a slow reply for the previous filter
   * cannot append its results to the new list.
   */
  private requestId = 0;

  /** Fetches the first page for the current filters, replacing what's shown. */
  protected reload(): void {
    const id = ++this.requestId;
    this.loading.set(true);

    this.productService
      .page({
        search: this.searchTerm(),
        categoryId: 0,
        condition: this.condition() === 'all' ? '' : this.condition(),
        maxPrice: this.maxPrice() ?? 0,
        sort: this.sort(),
        skip: 0,
        take: this.PAGE_SIZE,
      })
      .subscribe({
        next: (page) => {
          if (id !== this.requestId) return;   // a newer filter won

          this.products.set(page.items);
          this.total.set(page.total);
          this.hasMore.set(page.hasMore);
          this.loading.set(false);
        },
        error: () => {
          if (id !== this.requestId) return;
          this.loading.set(false);
        },
      });
  }

  /** Appends the next page. Called when the sentinel scrolls into view. */
  protected loadMore(): void {
    if (this.loadingMore() || !this.hasMore() || this.loading()) return;

    const id = this.requestId;
    this.loadingMore.set(true);

    this.productService
      .page({
        search: this.searchTerm(),
        condition: this.condition() === 'all' ? '' : this.condition(),
        maxPrice: this.maxPrice() ?? 0,
        sort: this.sort(),
        skip: this.products().length,
        take: this.PAGE_SIZE,
      })
      .subscribe({
        next: (page) => {
          if (id !== this.requestId) return;

          this.products.update((list) => [...list, ...page.items]);
          this.total.set(page.total);
          this.hasMore.set(page.hasMore);
          this.loadingMore.set(false);
        },
        error: () => this.loadingMore.set(false),
      });
  }
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
   * What the grid shows.
   *
   * Search, condition, price and sort are done by the DATABASE and arrive
   * already filtered. Only the category sidebar is applied here, because it
   * filters by name and the pages are already narrow.
   */
  protected readonly visible = computed<Product[]>(() => {
    const cat = this.category();

    let list = this.products().filter((p) => cat === 'All' || p.category === cat);

    // Ordering is decided by the query, so nothing to re-sort here.
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

  /**
   * The homepage sections stay put while FILTERING, and hide only for a text
   * search.
   *
   * Removing them on every chip click changed the page height above the grid,
   * so the viewport jumped to the top and the reader lost their place. A filter
   * is a refinement of the same page; a search is a different intent.
   */
  protected readonly showSections = computed(
    () => this.searchTerm().trim() === '' && this.products().length > 0,
  );

  /**
   * True when any filter is narrowing the page.
   *
   * The strips at the top show "best deals" and "just arrived" from the WHOLE
   * shop, which is confusing beside a filtered grid — you tick "Brand new" and
   * the top of the page carries on showing used items. So the strips collapse
   * into a summary line instead.
   */
  protected readonly filtering = computed(
    () =>
      this.condition() !== 'all' ||
      this.maxPrice() !== null ||
      this.category() !== 'All',
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

  /**
   * Picking a category scrolls to the grid rather than teleporting there.
   *
   * A smooth scroll keeps the reader oriented — they can see where they came
   * from, which is exactly what an abrupt jump takes away.
   */
  protected jumpToCatalogue(categoryName: string): void {
    this.category.set(categoryName);

    document.getElementById('catalogue')?.scrollIntoView({
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'start',
    });
  }

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
    /*
     * Any change to a server-side filter starts a fresh first page.
     *
     * An effect rather than wiring each control, so adding a filter later
     * cannot forget to trigger a reload — the dependency is picked up simply
     * by being read.
     */
    effect(() => {
      // Read them so the effect re-runs when any of them change.
      this.searchTerm();
      this.condition();
      this.maxPrice();
      this.sort();

      this.reload();
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

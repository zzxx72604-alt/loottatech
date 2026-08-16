import { ChangeDetectionStrategy, Component, Input, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ProductService } from '../../core/services/product.service';
import { CartService } from '../../core/services/cart.service';
import { ProductCard } from '../../shared/components/product-card/product-card';
import { ProductCardSkeleton } from '../../shared/components/product-card-skeleton/product-card-skeleton';
import { Condition, Product, discountPercent } from '../../shared/models/product';

type SortMode = 'recommended' | 'price-asc' | 'price-desc' | 'discount';

interface CategoryCount {
  name: string;
  count: number;
}

@Component({
  selector: 'app-catalog',
  imports: [FormsModule, ProductCard, ProductCardSkeleton],
  templateUrl: './catalog.html',
  styleUrl: './catalog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Catalog {
  private readonly productService = inject(ProductService);
  private readonly cart = inject(CartService);

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

  protected trackById(_index: number, product: Product): string {
    return product.id;
  }
}

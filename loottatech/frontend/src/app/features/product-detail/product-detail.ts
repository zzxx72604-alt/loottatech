import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Input,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CurrencyPipe, NgOptimizedImage } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ProductService } from '../../core/services/product.service';
import { CartService } from '../../core/services/cart.service';
import { RecentlyViewedService } from '../../core/services/recently-viewed.service';
import { ConditionBadge } from '../../shared/components/condition-badge/condition-badge';
import { InteractionButtons } from '../../shared/components/interaction-buttons/interaction-buttons';
import { StarRating } from '../../shared/components/star-rating/star-rating';
import { ReviewsSection } from './reviews-section';
import { ShareSheet } from '../../shared/components/share-sheet/share-sheet';
import { ReportDialog } from '../../shared/components/report-dialog/report-dialog';
import { ProductCard } from '../../shared/components/product-card/product-card';
import { ScrollStrip } from '../../shared/components/scroll-strip/scroll-strip';
import { ToastService } from '../../core/services/toast.service';
import { ActivatedRoute, Router } from '@angular/router';
import { Product, discountPercent } from '../../shared/models/product';

/**
 * The full product page: gallery, specs, honest condition notes, and the
 * like/save buttons that share state with every product card.
 */
@Component({
  selector: 'app-product-detail',
  imports: [
    InteractionButtons,
    StarRating,
    ReviewsSection,
    ShareSheet,
    ReportDialog,
    ProductCard,
    ScrollStrip,
    NgOptimizedImage,
    CurrencyPipe,
    ConditionBadge,
  ],
  templateUrl: './product-detail.html',
  styleUrl: './product-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductDetail {
  private readonly productService = inject(ProductService);
  private readonly cart = inject(CartService);
  private readonly recent = inject(RecentlyViewedService);
  private readonly toasts = inject(ToastService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly product = signal<Product | null>(null);
  protected readonly loading = signal(true);

  /** Captured here, in an injection context, so the @Input setter below can
      use takeUntilDestroyed() safely. */
  private readonly destroyRef = inject(DestroyRef);
  protected readonly activeImage = signal(0);

  /** Share links arrive as /p/:code and resolve the same product. */
  @Input() set code(value: string) {
    if (!value) return;

    this.loading.set(true);
    this.productService
      .getByCode(value)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (product: Product) => {
          this.product.set(product);
          this.recent.add(product);
          this.loadRelated(product.id);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  @Input() set id(value: string) {
    this.loading.set(true);
    this.productService
      .getById(value)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (p) => {
          this.product.set(p);
          this.activeImage.set(0);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  protected discount(p: Product): number {
    return discountPercent(p);
  }

  protected addWithToast(event?: Event): void {
    const p = this.product();
    if (!p) return;

    const button = event?.currentTarget as HTMLElement | null;
    if (button) this.cart.flyToCart(button.getBoundingClientRect());

    this.cart.add(p);
    this.toasts.success(`${p.title} added to your cart`, {
      label: 'View cart',
      link: '/cart',
    });
  }

  /* --------------------------------------------------------- gallery */

  protected readonly showArrows = signal(false);

  protected nextImage(step: number): void {
    const images = this.product()?.images ?? [];
    if (images.length < 2) return;

    // Wraps at both ends, so the arrows never dead-end.
    const count = images.length;
    this.activeImage.update((i) => (i + step + count) % count);
  }

  /* ----------------------------------------------------------- share */

  protected readonly sharing = signal(false);
  protected readonly reporting = signal(false);

  /* --------------------------------------------------------- buy now */

  protected readonly confirmingBuy = signal(false);

  protected readonly cartCount = this.cart.count;

  /** Suggested products, loaded alongside the page. */
  protected readonly relatedProducts = signal<Product[]>([]);

  /** Other things this browser looked at, minus the current product. */
  protected readonly alsoViewed = computed(() =>
    this.recent.others(this.product()?.id ?? 0),
  );

  /**
   * Buy this one item.
   *
   * If the cart already holds something, ask first — silently checking out a
   * different set of products than the one on screen would be the worst kind
   * of surprise.
   */
  protected buyNow(): void {
    if (this.cart.items().length > 0) {
      this.confirmingBuy.set(true);
      return;
    }
    this.goDirect();
  }

  protected goDirect(): void {
    const product = this.product();
    if (!product) return;

    this.confirmingBuy.set(false);
    this.cart.buyNow(product);
    this.router.navigate(['/checkout']);
  }

  protected addInstead(): void {
    const product = this.product();
    if (!product) return;

    this.confirmingBuy.set(false);
    this.cart.add(product);
    this.toasts.success(`${product.title} added to your cart`, { label: 'View cart', link: '/cart' });
  }

  /* ------------------------------------------------ recently viewed strip */

  protected onRecentAdd(product: Product): void {
    this.cart.add(product);
    this.toasts.success(`${product.title} added to your cart`, {
      label: 'View cart',
      link: '/cart',
    });
  }

  protected onRecentBuy(product: Product): void {
    if (this.cart.items().length > 0) {
      this.router.navigate(['/product', product.id], { queryParams: { buy: 1 } });
      return;
    }

    this.cart.buyNow(product);
    this.router.navigate(['/checkout']);
  }

  private loadRelated(id: number): void {
    this.productService.related(id).subscribe({
      next: (products) => this.relatedProducts.set(products),
      error: () => this.relatedProducts.set([]),
    });
  }
}

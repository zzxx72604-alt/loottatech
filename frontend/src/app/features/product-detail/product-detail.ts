import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Input,
  inject,
  signal,
} from '@angular/core';
import { CurrencyPipe, NgOptimizedImage } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ProductService } from '../../core/services/product.service';
import { CartService } from '../../core/services/cart.service';
import { ConditionBadge } from '../../shared/components/condition-badge/condition-badge';
import { Product, discountPercent } from '../../shared/models/product';

/** Day 1 version — enough to browse and add to cart. Day 2 adds the gallery,
    related products behind @defer, and the full trust panel. */
@Component({
  selector: 'app-product-detail',
  imports: [NgOptimizedImage, CurrencyPipe, ConditionBadge],
  templateUrl: './product-detail.html',
  styleUrl: './product-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductDetail {
  private readonly productService = inject(ProductService);
  private readonly cart = inject(CartService);

  protected readonly product = signal<Product | null>(null);
  protected readonly loading = signal(true);

  /** Captured here, in an injection context, so the @Input setter below can
      use takeUntilDestroyed() safely. */
  private readonly destroyRef = inject(DestroyRef);
  protected readonly activeImage = signal(0);

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

  protected add(): void {
    const p = this.product();
    if (p) this.cart.add(p);
  }
}

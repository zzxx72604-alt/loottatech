import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, computed, signal } from '@angular/core';
import { CurrencyPipe, NgOptimizedImage } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  Product,
  conditionGrade,
  discountPercent,
  productTags,
} from '../../models/product';

/**
 * A product tile.
 *
 * Deliberately has NO service dependencies. It takes a product in and emits
 * events out, so the same card works in the catalogue, the "best deals" strip
 * and search results without knowing which one it is in. The parent decides
 * what "add to cart" means.
 */
@Component({
  selector: 'app-product-card',
  imports: [NgOptimizedImage, CurrencyPipe, RouterLink],
  templateUrl: './product-card.html',
  styleUrl: './product-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductCard {
  private readonly current = signal<Product | null>(null);

  @Input({ required: true }) set product(value: Product) {
    this.current.set(value);
  }

  /** Only the first few cards should preload their image. */
  @Input() priority = false;

  @Output() addToCart = new EventEmitter<Product>();
  @Output() toggleWatch = new EventEmitter<Product>();

  protected readonly item = this.current.asReadonly();

  protected readonly grade = computed(() => {
    const p = this.current();
    return p ? conditionGrade(p.condition) : { score: '', letter: '' };
  });

  protected readonly discount = computed(() => {
    const p = this.current();
    return p ? discountPercent(p) : 0;
  });

  protected readonly saving = computed(() => {
    const p = this.current();
    return p && p.originalPrice > p.price ? p.originalPrice - p.price : 0;
  });

  protected readonly tags = computed(() => {
    const p = this.current();
    return p ? productTags(p) : [];
  });

  protected readonly isNew = computed(() => this.current()?.condition === 'new');

  protected onAdd(event: Event): void {
    // The card is a link; adding to the cart must not navigate.
    event.preventDefault();
    event.stopPropagation();

    const p = this.current();
    if (p) this.addToCart.emit(p);
  }

  protected onWatch(event: Event): void {
    event.preventDefault();
    event.stopPropagation();

    const p = this.current();
    if (p) this.toggleWatch.emit(p);
  }
}

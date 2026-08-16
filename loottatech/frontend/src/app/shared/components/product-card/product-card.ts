import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CurrencyPipe } from '@angular/common';
import { ConditionBadge } from '../condition-badge/condition-badge';
import { Product, discountPercent } from '../../models/product';

/**
 * A DUMB component.
 *
 * It receives one product through @Input and reports what the user did through
 * @Output. It never injects CartService, never calls the API, and holds no
 * state of its own — so it can be dropped on any page and behaves identically.
 *
 * The parent decides what "add to cart" actually means. This is the same
 * child -> parent pattern as the classroom EventEmitter example, on real data.
 */
@Component({
  selector: 'app-product-card',
  imports: [NgOptimizedImage, RouterLink, CurrencyPipe, ConditionBadge],
  templateUrl: './product-card.html',
  styleUrl: './product-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductCard {
  @Input({ required: true }) product!: Product;

  /** First few cards are above the fold — load them eagerly for a fast LCP. */
  @Input() priority = false;

  @Output() addToCart = new EventEmitter<Product>();
  @Output() toggleWatch = new EventEmitter<Product>();

  protected get discount(): number {
    return discountPercent(this.product);
  }

  protected onAddToCart(event: Event): void {
    // The whole card is a link — stop the click from navigating.
    event.preventDefault();
    event.stopPropagation();
    this.addToCart.emit(this.product);
  }

  protected onToggleWatch(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.toggleWatch.emit(this.product);
  }
}

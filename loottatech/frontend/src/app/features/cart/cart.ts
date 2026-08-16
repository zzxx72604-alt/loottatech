import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CurrencyPipe, NgOptimizedImage } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CartService } from '../../core/services/cart.service';
import { ConditionBadge } from '../../shared/components/condition-badge/condition-badge';
import { Condition } from '../../shared/models/product';

@Component({
  selector: 'app-cart',
  imports: [NgOptimizedImage, CurrencyPipe, RouterLink, ConditionBadge],
  templateUrl: './cart.html',
  styleUrl: './cart.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Cart {
  protected readonly cart = inject(CartService);

  protected readonly isEmpty = computed(() => this.cart.items().length === 0);

  protected asCondition(value: string): Condition {
    return value as Condition;
  }
}

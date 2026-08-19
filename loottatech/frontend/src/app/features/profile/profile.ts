import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { ProfileService } from '../../core/services/profile.service';
import { InteractionStore } from '../../core/services/interaction.store';
import { UserService } from '../../core/services/user.service';
import { CartService } from '../../core/services/cart.service';
import { ToastService } from '../../core/services/toast.service';
import { AchievementSet, Profile } from '../../shared/models/profile';
import { Product } from '../../shared/models/product';
import { ProductCard } from '../../shared/components/product-card/product-card';

type Tab = 'saved' | 'liked' | 'orders' | 'badges';

@Component({
  selector: 'app-profile',
  imports: [CurrencyPipe, DatePipe, RouterLink, ProductCard],
  templateUrl: './profile.html',
  styleUrl: './profile.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfilePage {
  private readonly api = inject(ProfileService);
  private readonly cart = inject(CartService);
  private readonly toasts = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly users = inject(UserService);
  protected readonly store = inject(InteractionStore);

  protected readonly profile = signal<Profile | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal('');

  protected readonly tab = signal<Tab>('saved');

  protected readonly saved = signal<Product[]>([]);
  protected readonly liked = signal<Product[]>([]);
  protected readonly badges = signal<AchievementSet | null>(null);
  private readonly loadedTabs = new Set<Tab>();

  /** Initials as a stand-in avatar until picture upload exists. */
  protected readonly initials = computed(() => {
    const name = this.profile()?.name ?? this.users.user()?.name ?? '';
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('');
  });

  constructor() {
    this.api.get().subscribe({
      next: (profile) => {
        this.profile.set(profile);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(this.explain(err));
        this.loading.set(false);
      },
    });

    this.load('saved');
  }

  /** Lists are fetched the first time their tab is opened, not before. */
  protected setTab(tab: Tab): void {
    this.tab.set(tab);
    this.load(tab);
  }

  private load(tab: Tab): void {
    if (tab === 'orders' || this.loadedTabs.has(tab)) return;
    this.loadedTabs.add(tab);

    if (tab === 'badges') {
      this.api.achievements().subscribe({
        next: (set) => this.badges.set(set),
        error: () => this.loadedTabs.delete(tab),
      });
      return;
    }

    const request = tab === 'saved' ? this.api.saves() : this.api.likes();
    const target = tab === 'saved' ? this.saved : this.liked;

    request.subscribe({
      next: (products) => target.set(products),
      error: () => this.loadedTabs.delete(tab),
    });
  }

  protected onAddToCart(product: Product): void {
    this.cart.add(product);
    this.toasts.success(`${product.title} added to your cart`, {
      label: 'View cart',
      link: '/cart',
    });
  }

  protected signOut(): void {
    this.users.logout();
    this.router.navigateByUrl('/');
  }

  private explain(err: unknown): string {
    const e = err as { status?: number };
    if (e.status === 0) return "Can't reach the shop. Is the API running?";
    return 'Could not load your profile.';
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

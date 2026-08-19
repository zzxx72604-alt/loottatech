import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CurrencyPipe } from '@angular/common';
import { CartService } from '../../core/services/cart.service';
import { computed } from '@angular/core';
import { ThemeService } from '../../core/services/theme.service';
import { UserService } from '../../core/services/user.service';
import { SearchService, Suggestion } from '../../core/services/search.service';
import { NotificationBell } from '../../shared/components/notification-bell/notification-bell';

@Component({
  selector: 'app-header',
  imports: [NotificationBell, RouterLink, FormsModule, CurrencyPipe],
  templateUrl: './header.html',
  styleUrl: './header.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Header {
  private readonly router = inject(Router);

  protected readonly cart = inject(CartService);
  protected readonly themeService = inject(ThemeService);
  protected readonly users = inject(UserService);
  private readonly search$ = inject(SearchService);

  /** Suggestions for what is currently typed. */
  protected readonly suggestions = signal<Suggestion[]>([]);
  protected readonly showSuggestions = signal(false);

  /** Keyboard highlight, -1 meaning nothing chosen yet. */
  protected readonly activeIndex = signal(-1);

  protected onType(value: string): void {
    this.term.set(value);
    this.search$.ensureLoaded();

    const results = this.search$.suggest(value);
    this.suggestions.set(results);
    this.showSuggestions.set(results.length > 0);
    this.activeIndex.set(-1);
  }

  protected onFocus(): void {
    if (this.suggestions().length > 0) this.showSuggestions.set(true);
    this.search$.ensureLoaded();
  }

  /** Blur is delayed so a click on a suggestion still registers. */
  protected onBlur(): void {
    setTimeout(() => this.showSuggestions.set(false), 120);
  }

  protected move(step: number): void {
    const count = this.suggestions().length;
    if (count === 0) return;

    this.activeIndex.update((i) => {
      const next = i + step;
      if (next < -1) return count - 1;
      if (next >= count) return -1;
      return next;
    });
  }

  protected choose(suggestion: Suggestion): void {
    this.showSuggestions.set(false);
    this.term.set('');
    this.router.navigate(['/product', suggestion.product.id]);
  }

  /** Enter picks the highlighted suggestion, or runs a normal search. */
  protected onEnter(): void {
    const index = this.activeIndex();
    const results = this.suggestions();

    if (index >= 0 && results[index]) {
      this.choose(results[index]);
      return;
    }

    this.showSuggestions.set(false);
    this.search();
  }

  /** Initials stand in for a profile picture until uploads exist. */
  protected readonly initials = computed(() => {
    const name = this.users.user()?.name ?? '';
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('');
  });

  protected readonly term = signal('');

  protected readonly quickLinks = [
    'iPhone',
    'ThinkPad',
    'Apple Watch',
    'Xiaomi',
    'Mouse',
    'Under $100',
  ];

  protected search(): void {
    const value = this.term().trim();
    this.router.navigate(value ? ['/search', value] : ['/']);
  }

  protected signOut(): void {
    this.users.logout();
    this.router.navigateByUrl('/');
  }

  protected quickSearch(value: string): void {
    this.term.set(value);
    this.search();
  }
}

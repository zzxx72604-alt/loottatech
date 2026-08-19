import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CartService } from '../../core/services/cart.service';
import { computed } from '@angular/core';
import { ThemeService } from '../../core/services/theme.service';
import { UserService } from '../../core/services/user.service';

@Component({
  selector: 'app-header',
  imports: [RouterLink, FormsModule],
  templateUrl: './header.html',
  styleUrl: './header.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Header {
  private readonly router = inject(Router);

  protected readonly cart = inject(CartService);
  protected readonly themeService = inject(ThemeService);
  protected readonly users = inject(UserService);

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

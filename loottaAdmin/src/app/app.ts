import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from './core/services/auth.service';
import { OrderNotifier } from './core/services/order-notifier.service';
import { OrderSummary } from './shared/models/order';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CurrencyPipe],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  private readonly router = inject(Router);

  /** Injected here so polling starts as soon as the admin app opens. */
  protected readonly notifier = inject(OrderNotifier);
  protected readonly auth = inject(AuthService);

  protected signOut(): void {
    this.auth.logout();
    this.router.navigateByUrl('/login');
  }

  protected open(order: OrderSummary): void {
    this.notifier.dismiss(order.id);
    this.router.navigateByUrl('/orders');
  }
}

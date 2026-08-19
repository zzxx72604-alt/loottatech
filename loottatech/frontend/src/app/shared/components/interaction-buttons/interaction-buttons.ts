import { ChangeDetectionStrategy, Component, Input, inject } from '@angular/core';
import { Router } from '@angular/router';
import { InteractionStore } from '../../../core/services/interaction.store';
import { UserService } from '../../../core/services/user.service';

/**
 * Like and Save, as a pair.
 *
 * Reads straight from InteractionStore, so the same product shows the same
 * state on a card, in a strip and on its detail page without any component
 * passing anything to another.
 */
@Component({
  selector: 'app-interaction-buttons',
  templateUrl: './interaction-buttons.html',
  styleUrl: './interaction-buttons.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InteractionButtons {
  private readonly router = inject(Router);

  protected readonly store = inject(InteractionStore);
  protected readonly users = inject(UserService);

  @Input({ required: true }) productId!: number;

  /** "compact" for cards, "full" for the detail page. */
  @Input() variant: 'compact' | 'full' = 'compact';

  protected like(event: Event): void {
    event.preventDefault();
    event.stopPropagation();

    if (!this.users.isLoggedIn()) return this.askToSignIn();
    this.store.toggleLike(this.productId);
  }

  protected save(event: Event): void {
    event.preventDefault();
    event.stopPropagation();

    if (!this.users.isLoggedIn()) return this.askToSignIn();
    this.store.toggleSave(this.productId);
  }

  private askToSignIn(): void {
    this.router.navigate(['/login'], {
      queryParams: { returnUrl: this.router.url },
    });
  }
}

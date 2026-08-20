import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { ProfileService } from '../../../core/services/profile.service';
import { UserService } from '../../../core/services/user.service';
import { ThemeService } from '../../../core/services/theme.service';
import { Profile } from '../../models/profile';
import { ConfirmDialog } from '../confirm-dialog/confirm-dialog';

/**
 * The card that drops down when the pointer rests on the avatar.
 *
 * Two things are worth pointing out about how this loads.
 *
 * The profile is fetched on FIRST HOVER, not when the header renders. Most
 * visits never touch the avatar, so requesting level, coins and counts on
 * every page load would be a request nobody asked for. Once fetched it is
 * cached in a signal for the rest of the session.
 *
 * While it is in flight the card still opens, showing the name and avatar we
 * already hold from the login response plus skeleton bars for the numbers.
 * An empty card that pops in later feels slower than a card that is there
 * immediately and fills in.
 */
@Component({
  selector: 'app-mini-profile',
  imports: [RouterLink, DecimalPipe, ConfirmDialog],
  templateUrl: './mini-profile.html',
  styleUrl: './mini-profile.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MiniProfile {
  private readonly profiles = inject(ProfileService);

  protected readonly users = inject(UserService);
  protected readonly themeService = inject(ThemeService);

  protected readonly profile = signal<Profile | null>(null);
  private requested = false;

  constructor() {
    this.load();
  }

  /** Runs once per session. A failure clears the flag so hovering retries. */
  private load(): void {
    if (this.requested) return;
    this.requested = true;

    this.profiles.get().subscribe({
      next: (profile) => this.profile.set(profile),
      error: () => {
        this.requested = false;
      },
    });
  }

  /** Initials stand in until the avatar image loads, or if there is none. */
  protected initials(): string {
    const name = this.users.user()?.name ?? '';
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('');
  }

  /** Confirmed first — signing out by accident from a hover card is easy. */
  protected readonly confirmingSignOut = signal(false);

  protected signOut(): void {
    this.users.logout();
    location.href = '/';
  }
}

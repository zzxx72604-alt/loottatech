import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CurrencyPipe } from '@angular/common';
import { CartService } from '../../core/services/cart.service';
import { HostListener, computed } from '@angular/core';
import { ThemeService } from '../../core/services/theme.service';
import { UserService } from '../../core/services/user.service';
import { SearchService, Suggestion } from '../../core/services/search.service';
import { SearchHistoryService } from '../../core/services/search-history.service';
import { StoreContentService } from '../../core/services/store-content.service';
import { NotificationBell } from '../../shared/components/notification-bell/notification-bell';
import { MiniProfile } from '../../shared/components/mini-profile/mini-profile';
import { ConfirmDialog } from '../../shared/components/confirm-dialog/confirm-dialog';

@Component({
  selector: 'app-header',
  imports: [NotificationBell, MiniProfile, ConfirmDialog, RouterLink, FormsModule, CurrencyPipe],
  templateUrl: './header.html',
  styleUrl: './header.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Header {
  private readonly router = inject(Router);

  protected readonly cart = inject(CartService);
  protected readonly themeService = inject(ThemeService);
  protected readonly users = inject(UserService);
  protected readonly search$ = inject(SearchService);
  protected readonly history = inject(SearchHistoryService);
  protected readonly store = inject(StoreContentService);

  /* --------------------------------------------------- scroll behaviour */

  /** True once the page has moved away from the very top. */
  protected readonly scrolled = signal(false);

  /**
   * Compact mode: the shop tags are hidden and the bar is slimmer.
   *
   * Entered when scrolling DOWN, left when scrolling UP. That is the pattern
   * people already know from mobile apps — going back up is usually a sign of
   * wanting to navigate, so the controls come back.
   */
  protected readonly compact = signal(false);

  constructor() {
    // The header renders on every page, so loading here means the tags and
    // wording are requested exactly once per visit.
    this.store.load();
  }

  private lastScrollY = 0;
  private travelled = 0;
  private lastFlip = 0;

  /**
   * Passive listener: it promises never to call preventDefault, so the browser
   * keeps scrolling smoothly instead of waiting for this to finish.
   *
   * The first version flipped on any 6px movement, which oscillated: shrinking
   * the header changes the document height, the browser adjusts the scroll
   * position, that fires another scroll event, and it flips straight back —
   * thirty times a second.
   *
   * Two guards stop that. The state only changes after 60px of travel in ONE
   * direction, and never within 400ms of the last change. Both are far larger
   * than any adjustment the browser makes on its own.
   */
  @HostListener('window:scroll', [])
  protected onScroll(): void {
    const y = window.scrollY;
    const delta = y - this.lastScrollY;
    this.lastScrollY = y;

    this.scrolled.set(y > 20);

    // Near the top the header is always full, whatever the direction.
    if (y < 120) {
      this.travelled = 0;
      this.compact.set(false);
      return;
    }

    // Reset the tally whenever the direction changes.
    if ((delta > 0) !== (this.travelled > 0)) this.travelled = 0;
    this.travelled += delta;

    if (Math.abs(this.travelled) < 60) return;
    if (Date.now() - this.lastFlip < 400) return;

    const wantCompact = this.travelled > 0;
    if (wantCompact === this.compact()) return;

    // The search panel being open means the customer is using the box; the
    // header must not move under them.
    if (this.showPanel()) return;

    this.compact.set(wantCompact);
    this.travelled = 0;
    this.lastFlip = Date.now();
  }

  /** Clicking the search box always expands the header back out. */
  protected expand(): void {
    this.compact.set(false);
  }

  /** Matching items, shown under the phrases. Recomputed by the service. */
  protected readonly suggestions = this.search$.suggestions;

  /** The phrases offered as completions — what the arrow keys walk through. */
  protected readonly termSuggestions = this.search$.termSuggestions;
  protected readonly showPanel = signal(false);

  /** With nothing typed the panel offers history and popular brands instead. */
  protected readonly panelMode = computed<'suggestions' | 'browse'>(() =>
    this.term().trim().length > 0 ? 'suggestions' : 'browse',
  );

  /** Keyboard highlight, -1 meaning nothing chosen yet. */
  protected readonly activeIndex = signal(-1);

  protected onType(value: string): void {
    this.term.set(value);
    this.search$.setTerm(value);
    this.showPanel.set(true);
    this.activeIndex.set(-1);
  }

  protected onFocus(): void {
    this.search$.setTerm(this.term());
    this.showPanel.set(true);
    this.expand();
  }

  /** Blur is delayed so a click inside the panel still registers. */
  protected onBlur(): void {
    setTimeout(() => this.showPanel.set(false), 150);
  }

  /** Runs a search from a chip or a history entry. */
  protected runTerm(term: string): void {
    this.term.set(term);
    this.search$.setTerm(term);
    this.showPanel.set(false);
    this.history.add(term);
    this.router.navigate(['/search', term]);
  }

  protected forget(term: string, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.history.remove(term);
  }

  protected move(step: number): void {
    const count = this.termSuggestions().length;
    if (count === 0) return;

    this.activeIndex.update((i) => {
      const next = i + step;
      if (next < -1) return count - 1;
      if (next >= count) return -1;
      return next;
    });
  }

  protected choose(suggestion: Suggestion): void {
    this.showPanel.set(false);
    this.history.add(suggestion.product.title.split('—')[0].trim());
    this.term.set('');
    this.router.navigate(['/product', suggestion.product.id]);
  }

  /** Enter picks the highlighted suggestion, or runs a normal search. */
  protected onEnter(): void {
    const index = this.activeIndex();
    const highlighted = this.termSuggestions();

    // A highlighted phrase runs as a search rather than opening one product:
    // the reader picked a set of words, not an item.
    if (index >= 0 && highlighted[index]) {
      this.runTerm(highlighted[index].text);
      return;
    }

    this.showPanel.set(false);
    this.history.add(this.term());
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

  /* ------------------------------------------------ account hover card */

  protected readonly cardOpen = signal(false);
  private hoverTimer?: ReturnType<typeof setTimeout>;

  /**
   * Opening waits a moment; closing waits longer.
   *
   * The open delay stops the card flashing up when the pointer only crosses
   * the avatar on its way somewhere else. The close delay leaves time to
   * travel from the avatar down into the card — without it, the gap between
   * the two counts as leaving and the card vanishes mid-reach.
   */
  protected openCard(): void {
    clearTimeout(this.hoverTimer);
    if (this.cardOpen()) return;
    this.hoverTimer = setTimeout(() => this.cardOpen.set(true), 160);
  }

  protected closeCard(): void {
    clearTimeout(this.hoverTimer);
    this.hoverTimer = setTimeout(() => this.cardOpen.set(false), 240);
  }

  protected readonly term = signal('');

  /**
   * The tag row, from the database rather than this file.
   *
   * The shop owner adds and renames these in the admin site; hardcoding them
   * here meant a rebuild of the customer app to change one word.
   */
  protected readonly quickLinks = this.store.tags;

  protected search(): void {
    const value = this.term().trim();
    this.router.navigate(value ? ['/search', value] : ['/']);
  }

  protected readonly confirmingSignOut = signal(false);

  protected signOut(): void {
    this.confirmingSignOut.set(false);
    this.users.logout();
    this.router.navigateByUrl('/');
  }

  /** The label is what is shown; the query is what actually gets searched. */
  protected quickSearch(query: string, label: string): void {
    this.term.set(label);
    this.router.navigate(['/search', query]);
  }
}

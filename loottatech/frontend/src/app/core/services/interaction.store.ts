import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { ApiService } from './api.service';
import { UserService } from './user.service';
import { InteractionState, ToggleResult } from '../../shared/models/profile';

/**
 * One source of truth for what the customer has liked and saved.
 *
 * Why a store rather than per-component state: the same product appears on the
 * catalogue, the "best deals" strip and its own detail page. If each of those
 * tracked its own liked flag, they would drift the moment one changed — which
 * is exactly the inconsistency the spec calls out.
 *
 * Every card reads these signals, so a single toggle updates all of them at
 * once, with no events to wire up.
 */
@Injectable({ providedIn: 'root' })
export class InteractionStore {
  private readonly api = inject(ApiService);
  private readonly users = inject(UserService);

  /** Sets, not arrays — membership is checked once per card, per render. */
  private readonly likedIds = signal<ReadonlySet<number>>(new Set());
  private readonly savedIds = signal<ReadonlySet<number>>(new Set());

  /** Products currently mid-request, so the UI can disable double clicks. */
  private readonly pending = signal<ReadonlySet<number>>(new Set());

  readonly likeCount = computed(() => this.likedIds().size);
  readonly saveCount = computed(() => this.savedIds().size);

  constructor() {
    /*
     * Load on sign-in, clear on sign-out.
     *
     * An effect rather than a call in the constructor, because the user can
     * sign in and out without the app reloading — and a stale liked list
     * belonging to the previous account would be a privacy bug.
     */
    effect(() => {
      if (this.users.isLoggedIn()) this.refresh();
      else this.clear();
    });
  }

  isLiked(productId: number): boolean {
    return this.likedIds().has(productId);
  }

  isSaved(productId: number): boolean {
    return this.savedIds().has(productId);
  }

  isPending(productId: number): boolean {
    return this.pending().has(productId);
  }

  refresh(): void {
    this.api.get<InteractionState>('me/interactions').subscribe({
      next: (state) => {
        this.likedIds.set(new Set(state.liked));
        this.savedIds.set(new Set(state.saved));
      },
      error: () => this.clear(),
    });
  }

  clear(): void {
    this.likedIds.set(new Set());
    this.savedIds.set(new Set());
  }

  toggleLike(productId: number): void {
    this.toggle(productId, 'likes', this.likedIds);
  }

  toggleSave(productId: number): void {
    this.toggle(productId, 'saves', this.savedIds);
  }

  /**
   * Flips the state immediately, then asks the server.
   *
   * The heart fills the instant it is clicked — waiting for a round trip feels
   * broken. If the request fails the change is rolled back, which is the part
   * people forget: an optimistic update without a rollback is just a lie.
   */
  private toggle(
    productId: number,
    path: 'likes' | 'saves',
    target: ReturnType<typeof signal<ReadonlySet<number>>>,
  ): void {
    if (!this.users.isLoggedIn() || this.isPending(productId)) return;

    const before = target();
    const next = new Set(before);
    next.has(productId) ? next.delete(productId) : next.add(productId);

    target.set(next);
    this.pending.update((set) => new Set(set).add(productId));

    this.api.post<ToggleResult>(`me/${path}/${productId}`, {}).subscribe({
      next: (result) => {
        // Trust the server's answer over our guess.
        const confirmed = new Set(target());
        const isOn = path === 'likes' ? result.liked : result.saved;

        isOn ? confirmed.add(productId) : confirmed.delete(productId);
        target.set(confirmed);
        this.done(productId);
      },
      error: () => {
        target.set(before);   // roll back
        this.done(productId);
      },
    });
  }

  private done(productId: number): void {
    this.pending.update((set) => {
      const next = new Set(set);
      next.delete(productId);
      return next;
    });
  }
}

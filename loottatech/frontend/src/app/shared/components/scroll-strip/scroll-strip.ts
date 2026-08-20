import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  signal,
} from '@angular/core';

/** Past this many pixels the gesture was a drag, not a click on a card. */
const DRAG_SLOP = 6;

/** Below this speed at release there is nothing to carry, so no glide. */
const FLICK_MIN_SPEED = 0.35;

/** How far a flick coasts, and the ceiling on it, in pixels. */
const FLICK_SCALE = 170;
const FLICK_MAX = 900;

/**
 * A horizontal row of cards.
 *
 * Wraps whatever is projected into it, so the same behaviour serves "best
 * deals", "just arrived", "you might also like" and "recently viewed" without
 * four copies of the same scroll logic.
 *
 * Three ways to move it, each suited to its input: swipe on a touch screen,
 * drag with a mouse held down, or the arrows. The arrows are hidden when
 * there is nothing to scroll to in that direction — a button that does
 * nothing is worse than no button — and hidden entirely on narrow screens,
 * where they only steal room from the cards.
 */
@Component({
  selector: 'app-scroll-strip',
  templateUrl: './scroll-strip.html',
  styleUrl: './scroll-strip.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScrollStrip implements AfterViewInit, OnDestroy {
  @ViewChild('track') private track!: ElementRef<HTMLElement>;

  protected readonly canLeft = signal(false);
  protected readonly canRight = signal(false);

  /** Mouse held down on the row. */
  protected readonly pressing = signal(false);

  /** Held down *and* moved: the cards stop being clickable from here on. */
  protected readonly dragging = signal(false);

  private pointerId: number | null = null;
  private startX = 0;
  private startScroll = 0;
  private furthest = 0;

  /** Last sample, for the release speed. */
  private lastX = 0;
  private lastAt = 0;
  private speed = 0;

  /**
   * A card is a link. Once the mouse has travelled, the click that ends the
   * drag has to be swallowed or letting go anywhere over a card opens it.
   */
  private swallowClick = false;
  private detachClickGuard: (() => void) | null = null;

  ngAfterViewInit(): void {
    // Wait a frame so the projected cards have been laid out and measured.
    requestAnimationFrame(() => this.measure());

    // Capture phase: the card's own click handler runs on the way back up,
    // which is already too late to stop it.
    const el = this.track.nativeElement;
    const guard = (event: MouseEvent) => {
      if (!this.swallowClick) return;
      this.swallowClick = false;
      event.preventDefault();
      event.stopPropagation();
    };

    el.addEventListener('click', guard, true);
    this.detachClickGuard = () => el.removeEventListener('click', guard, true);
  }

  ngOnDestroy(): void {
    this.detachClickGuard?.();
  }

  protected measure(): void {
    const el = this.track?.nativeElement;
    if (!el) return;

    // A pixel of slack: sub-pixel widths otherwise leave the right arrow
    // showing forever at the end of the strip.
    this.canLeft.set(el.scrollLeft > 1);
    this.canRight.set(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }

  protected onPointerDown(event: PointerEvent): void {
    // A finger or a pen already scrolls this natively, and taking the events
    // over would only make that worse. Left button only: a right-click is a
    // context menu, and the middle one is a new tab.
    if (event.pointerType !== 'mouse' || event.button !== 0) return;

    const el = this.track.nativeElement;
    if (el.scrollWidth <= el.clientWidth) return;

    this.pointerId = event.pointerId;
    this.startX = this.lastX = event.clientX;
    this.startScroll = el.scrollLeft;
    this.lastAt = event.timeStamp;
    this.furthest = 0;
    this.speed = 0;
    this.swallowClick = false;

    // Only the cursor changes yet. Capturing the pointer now, or switching
    // off the cards' pointer events now, would retarget the click that ends
    // an ordinary press to this row and no card would ever open again.
    this.pressing.set(true);
  }

  protected onPointerMove(event: PointerEvent): void {
    if (event.pointerId !== this.pointerId) return;

    const el = this.track.nativeElement;
    const travelled = event.clientX - this.startX;
    this.furthest = Math.max(this.furthest, Math.abs(travelled));

    // Past the slop this is a drag rather than a press, so take the pointer
    // over: the row keeps moving if the mouse wanders off it, and the release
    // no longer lands on a card.
    if (!this.dragging() && this.furthest > DRAG_SLOP) {
      this.dragging.set(true);
      el.setPointerCapture(event.pointerId);
    }

    if (!this.dragging()) return;

    // Content follows the hand: drag left and the row moves left.
    el.scrollLeft = this.startScroll - travelled;

    const elapsed = event.timeStamp - this.lastAt;
    if (elapsed > 0) {
      this.speed = (event.clientX - this.lastX) / elapsed;
      this.lastX = event.clientX;
      this.lastAt = event.timeStamp;
    }

    // Without this the browser starts selecting the card text instead.
    event.preventDefault();
  }

  protected onPointerUp(event: PointerEvent): void {
    if (event.pointerId !== this.pointerId) return;

    const el = this.track.nativeElement;
    const dragged = this.dragging();

    if (dragged && el.hasPointerCapture(event.pointerId)) {
      el.releasePointerCapture(event.pointerId);
    }

    this.pointerId = null;
    this.pressing.set(false);
    this.dragging.set(false);

    // Belt and braces. Capturing the pointer already keeps the release off
    // the card in every browser that follows the spec here.
    this.swallowClick = dragged;

    const speed = this.speed;
    this.speed = 0;
    if (!dragged) return;

    // Let go while still moving and the row carries on a little, then comes
    // to rest with a card against the left edge — the same landing a swipe
    // gets on a phone, where the browser does it for us.
    const reduced = this.reducedMotion();
    const glide =
      reduced || Math.abs(speed) < FLICK_MIN_SPEED
        ? 0
        : Math.max(-FLICK_MAX, Math.min(FLICK_MAX, -speed * FLICK_SCALE));

    el.scrollTo({
      left: this.nearestCard(el.scrollLeft + glide),
      behavior: reduced ? 'auto' : 'smooth',
    });

    this.measure();
  }

  /**
   * Where the row should come to rest for a given target.
   *
   * The cards are snap points, but re-enabling snapping after a drag does not
   * pull the row onto one by itself, so the landing is worked out here and
   * scrolled to in a single smooth move.
   */
  private nearestCard(target: number): number {
    const el = this.track.nativeElement;
    const limit = el.scrollWidth - el.clientWidth;
    const wanted = Math.max(0, Math.min(limit, target));

    // Past the last full card there is nothing to snap to: the row simply
    // stops at its end, and forcing it backwards would feel like a rebound.
    if (wanted >= limit) return limit;

    const left = el.getBoundingClientRect().left;
    let best = wanted;
    let shortest = Number.POSITIVE_INFINITY;

    for (const card of Array.from(el.children)) {
      const start = card.getBoundingClientRect().left - left + el.scrollLeft;
      const gap = Math.abs(start - wanted);
      if (gap < shortest) {
        shortest = gap;
        best = start;
      }
    }

    return Math.max(0, Math.min(limit, Math.round(best)));
  }

  protected nudge(direction: -1 | 1): void {
    const el = this.track.nativeElement;

    // Move by most of a screenful, keeping a sliver visible so the reader
    // can see the row moved rather than jumping to unfamiliar content.
    const distance = el.clientWidth * 0.8 * direction;

    el.scrollBy({
      left: distance,
      behavior: this.reducedMotion() ? 'auto' : 'smooth',
    });
  }

  private reducedMotion(): boolean {
    return matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
}

import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewChild,
  signal,
} from '@angular/core';

/**
 * A horizontal row of cards with arrow buttons.
 *
 * Wraps whatever is projected into it, so the same behaviour serves "best
 * deals", "just arrived", "you might also like" and "recently viewed" without
 * four copies of the same scroll logic.
 *
 * Arrows are hidden when there is nothing to scroll to in that direction —
 * a button that does nothing is worse than no button.
 */
@Component({
  selector: 'app-scroll-strip',
  templateUrl: './scroll-strip.html',
  styleUrl: './scroll-strip.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScrollStrip implements AfterViewInit {
  @ViewChild('track') private track!: ElementRef<HTMLElement>;

  protected readonly canLeft = signal(false);
  protected readonly canRight = signal(false);

  ngAfterViewInit(): void {
    // Wait a frame so the projected cards have been laid out and measured.
    requestAnimationFrame(() => this.measure());
  }

  protected measure(): void {
    const el = this.track?.nativeElement;
    if (!el) return;

    // A pixel of slack: sub-pixel widths otherwise leave the right arrow
    // showing forever at the end of the strip.
    this.canLeft.set(el.scrollLeft > 1);
    this.canRight.set(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }

  protected nudge(direction: -1 | 1): void {
    const el = this.track.nativeElement;

    // Move by most of a screenful, keeping a sliver visible so the reader
    // can see the row moved rather than jumping to unfamiliar content.
    const distance = el.clientWidth * 0.8 * direction;

    el.scrollBy({
      left: distance,
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    });
  }
}

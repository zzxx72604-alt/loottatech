import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, computed, signal } from '@angular/core';

/**
 * Stars, in two modes.
 *
 * Read-only it shows a score with half-star precision. Interactive it becomes
 * a rating picker with hover preview. One component instead of two, because
 * the geometry is identical and only the behaviour differs.
 */
@Component({
  selector: 'app-star-rating',
  templateUrl: './star-rating.html',
  styleUrl: './star-rating.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StarRating {
  private readonly score = signal(0);

  @Input() set value(v: number) {
    this.score.set(v ?? 0);
  }

  /** When true the stars can be clicked to choose a rating. */
  @Input() interactive = false;

  @Input() size: 'sm' | 'md' | 'lg' = 'sm';

  @Output() rated = new EventEmitter<number>();

  protected readonly hovered = signal(0);
  protected readonly stars = [1, 2, 3, 4, 5];

  /** Hover wins while the pointer is over the control, so preview feels live. */
  protected readonly shown = computed(() => this.hovered() || this.score());

  protected fill(star: number): 'full' | 'half' | 'empty' {
    const shown = this.shown();
    if (shown >= star) return 'full';
    // Half only in read-only mode; picking half a star is a fiddly interaction.
    if (!this.interactive && shown >= star - 0.5) return 'half';
    return 'empty';
  }

  protected enter(star: number): void {
    if (this.interactive) this.hovered.set(star);
  }

  protected leave(): void {
    this.hovered.set(0);
  }

  protected pick(star: number): void {
    if (!this.interactive) return;
    this.score.set(star);
    this.rated.emit(star);
  }
}

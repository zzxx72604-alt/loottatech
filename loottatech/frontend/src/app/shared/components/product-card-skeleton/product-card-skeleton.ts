import { ChangeDetectionStrategy, Component, HostBinding, Input } from '@angular/core';

/** Grey placeholder shown while products load. Same shape as a real card, so
    nothing jumps when the data arrives. */
@Component({
  selector: 'app-product-card-skeleton',
  imports: [],
  template: `
    @for (i of items; track $index) {
      <article class="card" aria-hidden="true">
        <div class="skeleton thumb"></div>
        <div class="skeleton line"></div>
        <div class="skeleton line w60"></div>
        <div class="skeleton line w40 tall"></div>
      </article>
    }
  `,
  styles: `
    /* Several skeletons dissolve into the parent grid, one card each. */
    :host { display: contents; }

    /*
     * A lone skeleton stands in for a single card, so it needs a box of its
     * own. As a @defer placeholder it is the element the viewport trigger
     * measures, and display:contents leaves nothing to measure: the card
     * behind it would sit there grey forever, never scrolling into view.
     */
    :host(.single) { display: block; }

    .card {
      background: var(--surface);
      border-radius: var(--radius);
      padding: var(--sp-2);
      border: 1px solid var(--border);
    }
    .thumb { aspect-ratio: 1; width: 100%; margin-bottom: var(--sp-3); }
    .line { height: 11px; margin-bottom: 7px; }
    .w60 { width: 60%; }
    .w40 { width: 40%; }
    .tall { height: 16px; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductCardSkeleton {
  @Input() count = 10;

  @HostBinding('class.single') protected get single(): boolean {
    return this.count === 1;
  }

  get items(): number[] {
    return Array.from({ length: this.count }, (_, i) => i);
  }
}

import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

export interface Promo {
  title: string;
  line: string;
  cta: string;
  link: string;
  /** Optional query params, e.g. filtering the catalogue. */
  theme: 'brand' | 'dark' | 'sale';
}

/**
 * A promotional tile that sits in the product grid, the way marketplace apps
 * mix adverts between listings.
 *
 * Pure CSS and text — no image download, so it costs the page essentially
 * nothing and never pushes the layout around while loading.
 */
@Component({
  selector: 'app-ad-tile',
  imports: [RouterLink],
  templateUrl: './ad-tile.html',
  styleUrl: './ad-tile.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdTile {
  @Input({ required: true }) promo!: Promo;
}

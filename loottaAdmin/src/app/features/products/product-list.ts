import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ProductApi } from '../../core/services/product-api.service';
import { Product, conditionLabel, isNewProduct } from '../../shared/models/product';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-product-list',
  imports: [CurrencyPipe, FormsModule, RouterLink],
  templateUrl: './product-list.html',
  styleUrl: './product-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductList {
  private readonly api = inject(ProductApi);

  protected readonly products = signal<Product[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly search = signal('');

  protected readonly fileBase = environment.fileBase;

  protected readonly visible = computed(() => {
    const term = this.search().trim().toLowerCase();
    if (!term) return this.products();
    return this.products().filter((p) =>
      `${p.title} ${p.brand} ${p.category}`.toLowerCase().includes(term),
    );
  });

  protected readonly activeCount = computed(() => this.products().filter((p) => p.isActive).length);
  protected readonly outOfStock = computed(() => this.products().filter((p) => p.stock === 0).length);

  constructor() {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set('');

    this.api.list().subscribe({
      next: (products) => {
        this.products.set(products);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(this.explain(err));
        this.loading.set(false);
      },
    });
  }

  protected toggleActive(product: Product): void {
    const next = !product.isActive;

    // Update the row immediately, then roll it back if the API says no.
    this.patch(product.id, { isActive: next });

    this.api.setActive(product.id, next).subscribe({
      error: (err) => {
        this.patch(product.id, { isActive: !next });
        this.error.set(this.explain(err));
      },
    });
  }

  protected remove(product: Product): void {
    if (!confirm(`Delete "${product.title}"? Its photos and specs go with it. This cannot be undone.`)) {
      return;
    }

    this.api.remove(product.id).subscribe({
      next: () => this.products.update((list) => list.filter((p) => p.id !== product.id)),
      error: (err) => this.error.set(this.explain(err)),
    });
  }

  protected thumb(product: Product): string {
    if (!product.images.length) return '';
    // The API stores base paths; -480.webp is the small variant.
    return `${this.fileBase}${product.images[0]}-480.webp`;
  }

  protected label = conditionLabel;
  protected isNew = isNewProduct;

  private patch(id: number, changes: Partial<Product>): void {
    this.products.update((list) => list.map((p) => (p.id === id ? { ...p, ...changes } : p)));
  }

  private explain(err: unknown): string {
    const e = err as { status?: number; error?: unknown; message?: string };

    if (e.status === 0) return 'Cannot reach the API. Is it running on http://localhost:5197 ?';
    if (e.status === 401) return 'Not signed in, or the token expired. Sign in again.';
    if (e.status === 403) return 'This account is not allowed to do that.';
    if (typeof e.error === 'string' && e.error) return e.error;

    const problem = e.error as { title?: string; detail?: string } | undefined;
    if (problem?.detail) return `${e.status}: ${problem.detail}`;
    if (problem?.title) return `${e.status}: ${problem.title}`;

    return `Request failed with status ${e.status ?? 'unknown'}. Check the API terminal.`;
  }
}

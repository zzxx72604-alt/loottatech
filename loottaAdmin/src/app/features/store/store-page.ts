import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  Category,
  PaymentMethodSetting,
  QuickTag,
  SiteText,
  StoreApi,
} from '../../core/services/store-api.service';

type Tab = 'tags' | 'categories' | 'text' | 'payments';

/**
 * Everything about the shop that is wording rather than stock.
 *
 * One page with four tabs instead of four pages, because these are all "set it
 * once and rarely touch it again" settings — spreading them across the sidebar
 * would make the daily-use links (products, orders) harder to find.
 *
 * Every tab loads its own data the first time it is opened, not all four on
 * arrival. Somebody editing a tag should not be waiting on a payment methods
 * request they are never going to look at.
 */
@Component({
  selector: 'app-store-page',
  imports: [FormsModule],
  templateUrl: './store-page.html',
  styleUrl: './store-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StorePage {
  private readonly store = inject(StoreApi);

  protected readonly tab = signal<Tab>('tags');
  protected readonly message = signal('');
  protected readonly error = signal('');

  private readonly loadedTabs = new Set<Tab>();

  constructor() {
    this.open('tags');
  }

  protected open(tab: Tab): void {
    this.tab.set(tab);
    this.clearNotices();

    if (this.loadedTabs.has(tab)) return;
    this.loadedTabs.add(tab);

    if (tab === 'tags') this.loadTags();
    if (tab === 'categories') this.loadCategories();
    if (tab === 'text') this.loadTexts();
    if (tab === 'payments') this.loadPayments();
  }

  /* ------------------------------------------------------------- tags */

  protected readonly tags = signal<QuickTag[]>([]);
  protected newTagLabel = '';
  protected newTagQuery = '';

  private loadTags(): void {
    this.store.tags().subscribe({
      next: (tags) => this.tags.set(tags),
      error: () => this.error.set('Could not load the tag row.'),
    });
  }

  protected addTag(): void {
    const label = this.newTagLabel.trim();
    if (!label) return;

    const sortOrder = Math.max(0, ...this.tags().map((t) => t.sortOrder)) + 1;

    this.store
      .createTag({ label, query: this.newTagQuery.trim(), sortOrder, isActive: true })
      .subscribe({
        next: (tag) => {
          this.tags.update((list) => [...list, tag]);
          this.newTagLabel = '';
          this.newTagQuery = '';
          this.say(`Added "${tag.label}".`);
        },
        error: (err) => this.error.set(this.explain(err, 'Could not add that tag.')),
      });
  }

  protected saveTag(tag: QuickTag): void {
    this.store
      .updateTag(tag.id, {
        label: tag.label,
        query: tag.query,
        sortOrder: tag.sortOrder,
        isActive: tag.isActive,
      })
      .subscribe({
        next: () => this.say('Saved.'),
        error: (err) => this.error.set(this.explain(err, 'Could not save that tag.')),
      });
  }

  protected deleteTag(tag: QuickTag): void {
    if (!confirm(`Delete the "${tag.label}" shortcut?`)) return;

    // Removed from the list straight away, and put back if the server
    // disagrees — the row disappearing instantly is what makes it feel quick.
    const before = this.tags();
    this.tags.update((list) => list.filter((t) => t.id !== tag.id));

    this.store.deleteTag(tag.id).subscribe({
      next: () => this.say(`Deleted "${tag.label}".`),
      error: () => {
        this.tags.set(before);
        this.error.set('Could not delete that tag.');
      },
    });
  }

  /* ------------------------------------------------------- categories */

  protected readonly categories = signal<Category[]>([]);
  protected newCategoryName = '';

  private loadCategories(): void {
    this.store.categories().subscribe({
      next: (rows) => this.categories.set(rows),
      error: () => this.error.set('Could not load categories.'),
    });
  }

  protected addCategory(): void {
    const name = this.newCategoryName.trim();
    if (!name) return;

    const sortOrder = Math.max(0, ...this.categories().map((c) => c.sortOrder)) + 1;

    this.store.createCategory({ name, slug: slugify(name), sortOrder }).subscribe({
      next: (category) => {
        this.categories.update((list) => [...list, { ...category, productCount: 0 }]);
        this.newCategoryName = '';
        this.say(`Added "${category.name}".`);
      },
      error: (err) => this.error.set(this.explain(err, 'Could not add that category.')),
    });
  }

  protected saveCategory(category: Category): void {
    this.store
      .updateCategory(category.id, {
        name: category.name,
        slug: category.slug,
        sortOrder: category.sortOrder,
      })
      .subscribe({
        next: () => this.say('Saved.'),
        error: (err) => this.error.set(this.explain(err, 'Could not save that category.')),
      });
  }

  protected deleteCategory(category: Category): void {
    if (category.productCount > 0) {
      this.error.set(
        `"${category.name}" still holds ${category.productCount} product(s). Move them to another category first.`,
      );
      return;
    }

    if (!confirm(`Delete the "${category.name}" category?`)) return;

    this.store.deleteCategory(category.id).subscribe({
      next: () => {
        this.categories.update((list) => list.filter((c) => c.id !== category.id));
        this.say(`Deleted "${category.name}".`);
      },
      error: (err) => this.error.set(this.explain(err, 'Could not delete that category.')),
    });
  }

  /* -------------------------------------------------------- shop text */

  protected readonly texts = signal<SiteText[]>([]);

  private loadTexts(): void {
    this.store.texts().subscribe({
      next: (rows) => this.texts.set(rows),
      error: () => this.error.set('Could not load the shop wording.'),
    });
  }

  protected saveTexts(): void {
    const values: Record<string, string> = {};
    for (const row of this.texts()) values[row.key] = row.value;

    this.store.saveTexts(values).subscribe({
      next: () => this.say('Wording saved. Reload the shop to see it.'),
      error: () => this.error.set('Could not save the wording.'),
    });
  }

  protected resetText(row: SiteText): void {
    this.texts.update((list) =>
      list.map((r) => (r.key === row.key ? { ...r, value: r.defaultValue } : r)),
    );
  }

  /* --------------------------------------------------- payment methods */

  protected readonly payments = signal<PaymentMethodSetting[]>([]);

  private loadPayments(): void {
    this.store.paymentMethods().subscribe({
      next: (rows) => this.payments.set(rows),
      error: () => this.error.set('Could not load payment methods.'),
    });
  }

  protected togglePayment(method: PaymentMethodSetting): void {
    this.payments.update((list) =>
      list.map((p) => (p.method === method.method ? { ...p, isEnabled: !p.isEnabled } : p)),
    );
  }

  protected savePayments(): void {
    if (!this.payments().some((p) => p.isEnabled)) {
      this.error.set('Leave at least one method on, or nobody can check out.');
      return;
    }

    this.store.savePaymentMethods(this.payments()).subscribe({
      next: () => this.say('Payment methods saved.'),
      error: (err) => this.error.set(this.explain(err, 'Could not save payment methods.')),
    });
  }

  /* ------------------------------------------------------------ shared */

  private say(text: string): void {
    this.error.set('');
    this.message.set(text);
    setTimeout(() => this.message.set(''), 2500);
  }

  private clearNotices(): void {
    this.message.set('');
    this.error.set('');
  }

  /** The API explains refusals in plain English; show that, not a status code. */
  private explain(err: unknown, fallback: string): string {
    const e = err as { error?: unknown; status?: number };
    if (typeof e.error === 'string' && e.error.length > 0) return e.error;
    if (e.status === 0) return 'Cannot reach the API. Is it running?';
    return fallback;
  }
}

/** "PC Parts" becomes "pc-parts", matching how the customer site links them. */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

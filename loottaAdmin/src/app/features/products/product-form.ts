import { ChangeDetectionStrategy, Component, Input, inject, signal } from '@angular/core';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CategoryApi, ProductApi } from '../../core/services/product-api.service';
import { CONDITIONS, Category, Condition, ProductWrite } from '../../shared/models/product';

/**
 * Reactive form for creating and editing a product.
 *
 * The interesting part is `specs`: a FormArray, because electronics have
 * different specifications from each other. A phone has battery health, a
 * laptop has a CPU. Fixed fields would be wrong for most products, so the
 * admin adds and removes spec rows as needed.
 */
@Component({
  selector: 'app-product-form',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './product-form.html',
  styleUrl: './product-form.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductForm {
  private readonly fb = inject(FormBuilder);
  private readonly products = inject(ProductApi);
  private readonly categories = inject(CategoryApi);
  private readonly router = inject(Router);

  protected readonly conditions = CONDITIONS;
  protected readonly categoryList = signal<Category[]>([]);

  protected readonly editingId = signal<number | null>(null);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal('');

  protected readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(160)]],
    brand: ['', [Validators.required, Validators.maxLength(60)]],
    categoryId: [0, [Validators.min(1)]],
    condition: ['good' as Condition, [Validators.required]],
    price: [0, [Validators.required, Validators.min(0)]],
    originalPrice: [0, [Validators.min(0)]],
    stock: [1, [Validators.required, Validators.min(0)]],
    warrantyMonths: [0, [Validators.min(0), Validators.max(120)]],
    tested: [true],
    isActive: [true],
    description: ['', [Validators.maxLength(2000)]],
    flawNotes: ['', [Validators.maxLength(600)]],
    specs: this.fb.array<ReturnType<ProductForm['newSpec']>>([]),
  });

  /** Route param → load the product for editing. Absent means "create". */
  @Input() set id(value: string) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) return;

    this.editingId.set(numeric);
    this.loading.set(true);

    this.products.get(numeric).subscribe({
      next: (p) => {
        this.form.patchValue({
          title: p.title,
          brand: p.brand,
          categoryId: p.categoryId,
          condition: p.condition,
          price: p.price,
          originalPrice: p.originalPrice,
          stock: p.stock,
          warrantyMonths: p.warrantyMonths,
          tested: p.tested,
          isActive: p.isActive,
          description: p.description,
          flawNotes: p.flawNotes,
        });

        this.specs.clear();
        for (const spec of p.specs) this.specs.push(this.newSpec(spec.key, spec.value));

        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(this.explain(err));
        this.loading.set(false);
      },
    });
  }

  constructor() {
    this.categories.list().subscribe({
      next: (list) => {
        this.categoryList.set(list);
        // Default to the first category when creating a new product.
        if (!this.editingId() && list.length && this.form.controls.categoryId.value === 0) {
          this.form.controls.categoryId.setValue(list[0].id);
        }
      },
      error: (err) => this.error.set(this.explain(err)),
    });

    if (this.specs.length === 0) this.addSpec();
  }

  /* -------------------------------------------------------- specs array */

  protected get specs(): FormArray {
    return this.form.controls.specs as unknown as FormArray;
  }

  protected newSpec(key = '', value = '') {
    return this.fb.nonNullable.group({
      key: [key, [Validators.required, Validators.maxLength(60)]],
      value: [value, [Validators.required, Validators.maxLength(200)]],
    });
  }

  protected addSpec(): void {
    this.specs.push(this.newSpec());
  }

  protected removeSpec(index: number): void {
    this.specs.removeAt(index);
  }

  /* ------------------------------------------------------------- submit */

  protected showError(name: string): boolean {
    const control = this.form.get(name);
    return !!control && control.invalid && control.touched;
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set('Please fix the highlighted fields.');
      return;
    }

    this.saving.set(true);
    this.error.set('');

    const body = this.form.getRawValue() as unknown as ProductWrite;
    const id = this.editingId();

    const request = id ? this.products.update(id, body) : this.products.create(body);

    request.subscribe({
      next: () => this.router.navigateByUrl('/products'),
      error: (err) => {
        this.error.set(this.explain(err));
        this.saving.set(false);
      },
    });
  }

  private explain(err: unknown): string {
    const e = err as { status?: number; error?: unknown };
    if (e.status === 0) return 'Cannot reach the API. Is it running on http://localhost:5197 ?';
    if (typeof e.error === 'string') return e.error;
    if (e.error && typeof e.error === 'object') {
      const problem = e.error as { errors?: Record<string, string[]>; title?: string };
      if (problem.errors) {
        return Object.values(problem.errors).flat().join(' ');
      }
      if (problem.title) return problem.title;
    }
    return 'Could not save the product.';
  }
}

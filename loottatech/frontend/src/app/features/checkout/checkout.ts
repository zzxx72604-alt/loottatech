import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged, startWith, switchMap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, of } from 'rxjs';
import { CartService } from '../../core/services/cart.service';
import { OrderService } from '../../core/services/order.service';
import { UserService } from '../../core/services/user.service';
import { DELIVERY_OPTIONS, DeliveryOption, OrderPreview } from '../../shared/models/order';

/**
 * REACTIVE form — the delivery option changes the total live, so the form
 * value has to be readable from TypeScript, not just bound to the template.
 *
 * Guests can check out. If someone happens to be signed in we prefill their
 * details and the backend links the order to their account.
 */
@Component({
  selector: 'app-checkout',
  imports: [ReactiveFormsModule, CurrencyPipe, RouterLink],
  templateUrl: './checkout.html',
  styleUrl: './checkout.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Checkout {
  private readonly fb = inject(FormBuilder);
  private readonly cart = inject(CartService);
  private readonly orders = inject(OrderService);
  private readonly router = inject(Router);

  protected readonly users = inject(UserService);

  protected readonly deliveryOptions = DELIVERY_OPTIONS;

  protected readonly submitting = signal(false);
  protected readonly error = signal('');

  protected readonly items = this.cart.items;
  protected readonly subtotal = this.cart.total;

  /** Mirrors the delivery control so the summary can react to it. */
  protected readonly chosenDelivery = signal<DeliveryOption>('Standard Delivery');

  /**
   * The priced order, straight from the API.
   *
   * The page deliberately does NOT add up the discount itself. It sends the
   * cart and the voucher code, and shows what the server says — the same code
   * path that will run when the order is placed, so the number can never
   * disagree with the receipt.
   */
  protected readonly preview = signal<OrderPreview | null>(null);
  protected readonly pricing = signal(false);

  protected readonly deliveryFee = computed(
    () => this.preview()?.deliveryFee
      ?? DELIVERY_OPTIONS.find((o) => o.value === this.chosenDelivery())?.fee
      ?? 0,
  );

  protected readonly discount = computed(() => this.preview()?.discount ?? 0);
  protected readonly coinsEarned = computed(() => this.preview()?.coinsEarned ?? 0);

  protected readonly total = computed(
    () => this.preview()?.total ?? this.subtotal() + this.deliveryFee(),
  );

  protected readonly form = this.fb.nonNullable.group({
    customerName: [this.usersName(), [Validators.required, Validators.minLength(2)]],
    phone: ['', [Validators.required, Validators.pattern(/^[0-9+\s-]{8,15}$/)]],
    address: ['', [Validators.required, Validators.minLength(5)]],
    deliveryOption: ['Standard Delivery' as DeliveryOption, [Validators.required]],
    note: [''],
    voucherCode: [''],
  });

  constructor() {
    this.form.controls.deliveryOption.valueChanges.subscribe((value) =>
      this.chosenDelivery.set(value),
    );

    /*
     * Re-price whenever the voucher code or delivery option changes.
     *
     *   debounceTime  — don't call the API on every keystroke
     *   switchMap     — cancel the previous request, so a slow reply for a
     *                   half-typed code can't overwrite a newer one
     */
    this.form.valueChanges
      .pipe(
        debounceTime(400),
        distinctUntilChanged(
          (a, b) => a.voucherCode === b.voucherCode && a.deliveryOption === b.deliveryOption,
        ),
        startWith(null),
        switchMap(() => {
          if (this.items().length === 0) return of(null);

          this.pricing.set(true);
          return this.orders
            .preview({
              items: this.items().map((line) => ({
                productId: line.product.id,
                quantity: line.quantity,
              })),
              customerName: 'preview',
              phone: '000000000',
              address: 'preview',
              deliveryOption: this.form.controls.deliveryOption.value,
              voucherCode: this.form.controls.voucherCode.value?.trim().toUpperCase(),
            })
            .pipe(catchError(() => of(null)));
        }),
        takeUntilDestroyed(),
      )
      .subscribe((priced) => {
        this.preview.set(priced);
        this.pricing.set(false);
      });
  }

  private usersName(): string {
    return inject(UserService).user()?.name ?? '';
  }

  protected showError(name: string): boolean {
    const c = this.form.get(name);
    return !!c && c.invalid && c.touched;
  }

  protected placeOrder(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    if (this.items().length === 0) {
      this.error.set('Your cart is empty.');
      return;
    }

    this.submitting.set(true);
    this.error.set('');

    const details = this.form.getRawValue();

    this.orders
      .create({
        items: this.items().map((line) => ({
          productId: line.product.id,
          quantity: line.quantity,
        })),
        ...details,
        voucherCode: details.voucherCode?.trim().toUpperCase(),
      })
      .subscribe({
        next: (order) => {
          this.cart.clear();
          this.router.navigate(['/order', order.orderNumber]);
        },
        error: (err) => {
          this.error.set(
            typeof err?.error === 'string' ? err.error : 'Could not place the order.',
          );
          this.submitting.set(false);
        },
      });
  }
}

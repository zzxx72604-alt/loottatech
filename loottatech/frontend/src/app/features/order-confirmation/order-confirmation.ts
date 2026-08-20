import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Input,
  inject,
  signal,
} from '@angular/core';
import { CurrencyPipe, DatePipe, NgOptimizedImage } from '@angular/common';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { OrderService } from '../../core/services/order.service';
import { Order, ORDER_STATUSES } from '../../shared/models/order';

@Component({
  selector: 'app-order-confirmation',
  imports: [CurrencyPipe, DatePipe, NgOptimizedImage, RouterLink],
  templateUrl: './order-confirmation.html',
  styleUrl: './order-confirmation.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderConfirmation {
  private readonly orders = inject(OrderService);

  protected readonly order = signal<Order | null>(null);
  protected readonly loading = signal(true);

  // ---- asking for a refund ----
  protected readonly asking = signal(false);
  protected readonly reason = signal('');
  protected readonly files = signal<File[]>([]);
  protected readonly sending = signal(false);
  protected readonly uploading = signal(false);
  protected readonly refundError = signal('');

  // ---- sending an approved return back ----
  protected readonly returnMethod = signal<'DropOff' | 'CourierPickup'>('DropOff');
  protected readonly returnAddress = signal('');
  protected readonly returnNote = signal('');

  /** Captured here, in an injection context, so the @Input setter below can
      use takeUntilDestroyed() safely. */
  private readonly destroyRef = inject(DestroyRef);

  /** The progress bar stops at Delivered; Cancelled is handled separately. */
  protected readonly steps = ORDER_STATUSES.filter((s) => s !== 'Cancelled');

  @Input() set orderNumber(value: string) {
    this.loading.set(true);
    this.orders
      .byNumber(value)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (order) => {
          this.order.set(order);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  protected stepIndex(order: Order): number {
    return this.steps.indexOf(order.status as (typeof this.steps)[number]);
  }

  protected cancelRefund(): void {
    this.asking.set(false);
    this.refundError.set('');
    this.reason.set('');
  }

  /** Three is the limit, so the extras are dropped here rather than rejected later. */
  protected onPickFiles(event: Event): void {
    const chosen = Array.from((event.target as HTMLInputElement).files ?? []);
    this.files.set(chosen.slice(0, 3));

    if (chosen.length > 3) {
      this.refundError.set('Three photos is the limit — the first three are attached.');
    }
  }

  /** A photo added after the request was already sent. */
  protected onExtraPhoto(event: Event, order: Order): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.uploading.set(true);
    this.refundError.set('');

    this.orders.addRefundPhoto(order.id, file).subscribe({
      next: (updated) => {
        this.order.set(updated);
        this.uploading.set(false);
        input.value = '';
      },
      error: (err: { error?: unknown }) => {
        this.refundError.set(this.explainRefund(err, 'Could not add that photo.'));
        this.uploading.set(false);
      },
    });
  }

  /**
   * Sends the request, then the photos.
   *
   * In that order because a photo has to belong to something: the request is
   * what the API attaches them to. If a photo fails the request still stands,
   * which is the right way round — evidence is helpful, not required.
   */
  protected sendRefund(order: Order): void {
    const reason = this.reason().trim();

    if (reason.length < 5) {
      this.refundError.set('A sentence is enough — what went wrong?');
      return;
    }

    this.sending.set(true);
    this.refundError.set('');

    this.orders.requestRefund(order.id, reason).subscribe({
      next: (updated) => {
        this.order.set(updated);
        this.asking.set(false);
        this.reason.set('');
        this.sending.set(false);
        this.uploadPending(updated);
      },
      error: (err: { error?: unknown }) => {
        this.refundError.set(this.explainRefund(err, 'Could not send that. Try again.'));
        this.sending.set(false);
      },
    });
  }

  /** One at a time, so a failure loses one photo rather than all of them. */
  private uploadPending(order: Order): void {
    const queue = this.files();
    this.files.set([]);
    if (!queue.length) return;

    this.uploading.set(true);

    const next = (index: number): void => {
      if (index >= queue.length) {
        this.uploading.set(false);
        return;
      }

      this.orders.addRefundPhoto(order.id, queue[index]).subscribe({
        next: (updated) => {
          this.order.set(updated);
          next(index + 1);
        },
        error: (err: { error?: unknown }) => {
          this.refundError.set(this.explainRefund(err, 'One of the photos would not upload.'));
          this.uploading.set(false);
        },
      });
    };

    next(0);
  }

  /** Tells the shop how an approved return is travelling back. */
  protected sendReturn(order: Order): void {
    const method = this.returnMethod();
    const address = this.returnAddress().trim();

    if (method === 'CourierPickup' && address.length < 5) {
      this.refundError.set('A courier needs somewhere to collect from.');
      return;
    }

    this.sending.set(true);
    this.refundError.set('');

    this.orders
      .arrangeReturn(order.id, { method, address, note: this.returnNote().trim() })
      .subscribe({
        next: (updated) => {
          this.order.set(updated);
          this.sending.set(false);
        },
        error: (err: { error?: unknown }) => {
          this.refundError.set(this.explainRefund(err, 'Could not save that. Try again.'));
          this.sending.set(false);
        },
      });
  }

  /** The stored path has no size on it; the shop serves three of each. */
  protected photo(basePath: string): string {
    return `${basePath}-480.webp`;
  }

  private explainRefund(err: { error?: unknown }, fallback: string): string {
    return typeof err.error === 'string' && err.error ? err.error : fallback;
  }
}

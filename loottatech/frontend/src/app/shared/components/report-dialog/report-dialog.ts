import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';

/**
 * Reports a product or a review.
 *
 * The reasons come from the API rather than being listed here, so the customer
 * site and the admin queue always agree on what the categories are.
 */
@Component({
  selector: 'app-report-dialog',
  imports: [FormsModule],
  templateUrl: './report-dialog.html',
  styleUrl: './report-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportDialog {
  private readonly api = inject(ApiService);
  private readonly toasts = inject(ToastService);

  @Input({ required: true }) target!: 'Product' | 'Review';
  @Input({ required: true }) targetId!: number;
  @Output() closed = new EventEmitter<void>();

  protected readonly reasons = signal<string[]>([]);
  protected readonly submitting = signal(false);
  protected readonly error = signal('');

  protected reason = '';
  protected details = '';

  constructor() {
    // Deferred to the microtask queue so @Input values are set first.
    queueMicrotask(() => {
      this.api.get<string[]>('reports/reasons', { target: this.target }).subscribe({
        next: (reasons) => {
          this.reasons.set(reasons);
          this.reason = reasons[0] ?? '';
        },
      });
    });
  }

  protected submit(): void {
    if (!this.reason) {
      this.error.set('Pick a reason.');
      return;
    }

    this.submitting.set(true);
    this.error.set('');

    this.api
      .post<void>('reports', {
        target: this.target,
        targetId: this.targetId,
        reason: this.reason,
        details: this.details,
      })
      .subscribe({
        next: () => {
          this.toasts.success('Thanks — we\'ll take a look.');
          this.submitting.set(false);
          this.closed.emit();
        },
        error: (err) => {
          const e = err as { status?: number; error?: unknown };
          this.error.set(
            e.status === 401
              ? 'Sign in to report something.'
              : typeof e.error === 'string'
                ? e.error
                : 'Could not send the report.',
          );
          this.submitting.set(false);
        },
      });
  }

  protected close(): void {
    this.closed.emit();
  }
}

import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: number;
  message: string;
  kind: 'success' | 'error' | 'info';
  /** Optional link, e.g. straight to the cart after adding something. */
  actionLabel?: string;
  actionLink?: string;
}

/**
 * Short confirmations that appear and leave on their own.
 *
 * Signals rather than a Subject, so templates read the list directly and
 * Angular handles the rendering — no subscription to manage, and nothing to
 * leak if a component forgets to unsubscribe.
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly items = signal<Toast[]>([]);
  readonly toasts = this.items.asReadonly();

  private nextId = 1;

  show(message: string, kind: Toast['kind'] = 'info', action?: { label: string; link: string }): void {
    const toast: Toast = {
      id: this.nextId++,
      message,
      kind,
      actionLabel: action?.label,
      actionLink: action?.link,
    };

    this.items.update((list) => [...list, toast]);
    setTimeout(() => this.dismiss(toast.id), 3200);
  }

  success(message: string, action?: { label: string; link: string }): void {
    this.show(message, 'success', action);
  }

  error(message: string): void {
    this.show(message, 'error');
  }

  dismiss(id: number): void {
    this.items.update((list) => list.filter((t) => t.id !== id));
  }
}

import { Injectable, signal } from '@angular/core';

/** Where notifications appear, the way a desktop chat app lets you choose. */
export type ToastCorner =
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'
  | 'bottom-center';

export const TOAST_CORNERS: { value: ToastCorner; label: string }[] = [
  { value: 'top-left', label: 'Top left' },
  { value: 'top-right', label: 'Top right' },
  { value: 'bottom-left', label: 'Bottom left' },
  { value: 'bottom-right', label: 'Bottom right' },
  { value: 'bottom-center', label: 'Bottom centre' },
];

const CORNER_KEY = 'lootta-toast-corner';

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

  /**
   * The chosen corner, remembered between visits.
   *
   * A preference, not account data — it belongs to this screen, not to the
   * person. Somebody on a laptop and a phone will want different answers, and
   * localStorage gives each device its own.
   */
  private readonly corner = signal<ToastCorner>(this.restoreCorner());
  readonly position = this.corner.asReadonly();

  setPosition(corner: ToastCorner): void {
    this.corner.set(corner);
    try {
      localStorage.setItem(CORNER_KEY, corner);
    } catch {
      // Blocked storage must not break notifications.
    }
  }

  private restoreCorner(): ToastCorner {
    const saved = localStorage.getItem(CORNER_KEY) as ToastCorner | null;
    const valid = TOAST_CORNERS.some((c) => c.value === saved);
    return valid ? saved! : 'bottom-right';
  }

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

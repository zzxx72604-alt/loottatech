import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface ConfirmState {
  title: string;
  message: string;
  confirmText: string;
  danger: boolean;
}

@Injectable({ providedIn: 'root' })
export class ConfirmService {
  state$ = new BehaviorSubject<ConfirmState | null>(null);
  private resolver?: (value: boolean) => void;

  ask(
    message: string,
    opts?: { title?: string; confirmText?: string; danger?: boolean }
  ): Promise<boolean> {
    this.state$.next({
      message,
      title: opts?.title ?? 'Are you sure?',
      confirmText: opts?.confirmText ?? 'Confirm',
      danger: opts?.danger ?? false,
    });
    return new Promise<boolean>((resolve) => (this.resolver = resolve));
  }

  resolve(value: boolean): void {
    this.state$.next(null);
    this.resolver?.(value);
    this.resolver = undefined;
  }
}

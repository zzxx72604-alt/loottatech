import { ChangeDetectionStrategy, Component, HostListener, ElementRef, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { NotificationStore } from '../../../core/services/notification.store';
import { AppNotification } from '../../../shared/models/notification';

@Component({
  selector: 'app-notification-bell',
  imports: [DatePipe],
  templateUrl: './notification-bell.html',
  styleUrl: './notification-bell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationBell {
  private readonly router = inject(Router);
  private readonly host = inject(ElementRef<HTMLElement>);

  protected readonly store = inject(NotificationStore);
  protected readonly open = signal(false);

  protected toggle(): void {
    const next = !this.open();
    this.open.set(next);

    // Fetch on open, so the panel is current even between polls.
    if (next) this.store.refresh();
  }

  /** Clicking anywhere else closes the panel. */
  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    if (!this.open()) return;
    if (!this.host.nativeElement.contains(event.target as Node)) this.open.set(false);
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.open.set(false);
  }

  protected go(notification: AppNotification): void {
    this.store.markRead(notification.id);
    this.open.set(false);

    if (notification.link) this.router.navigateByUrl(notification.link);
  }

  protected icon(kind: string): string {
    switch (kind) {
      case 'Order': return '📦';
      case 'Reward': return '◎';
      case 'Review': return '★';
      default: return 'ℹ';
    }
  }
}

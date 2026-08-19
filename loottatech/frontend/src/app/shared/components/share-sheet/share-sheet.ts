import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, computed, inject, signal } from '@angular/core';
import { ToastService } from '../../../core/services/toast.service';

/**
 * Share options for a product, in the style of a mobile share sheet.
 *
 * The link uses the product's PUBLIC code rather than its database id, so a
 * shared URL gives away nothing about the catalogue and can be read aloud.
 */
@Component({
  selector: 'app-share-sheet',
  templateUrl: './share-sheet.html',
  styleUrl: './share-sheet.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShareSheet {
  private readonly toasts = inject(ToastService);

  @Input({ required: true }) publicId!: string;
  @Input({ required: true }) title!: string;
  @Output() closed = new EventEmitter<void>();

  protected readonly copied = signal(false);

  /**
   * The canonical share URL.
   *
   * Built from the current origin so it works on localhost, on a LAN address,
   * and on a real domain later without a code change.
   */
  protected readonly url = computed(() =>
    `${location.origin}/p/${this.publicId}`,
  );

  protected readonly targets = [
    { key: 'facebook', label: 'Facebook', href: (u: string) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(u)}` },
    { key: 'telegram', label: 'Telegram', href: (u: string, t: string) => `https://t.me/share/url?url=${encodeURIComponent(u)}&text=${encodeURIComponent(t)}` },
    { key: 'x', label: 'X', href: (u: string, t: string) => `https://twitter.com/intent/tweet?url=${encodeURIComponent(u)}&text=${encodeURIComponent(t)}` },
    { key: 'whatsapp', label: 'WhatsApp', href: (u: string, t: string) => `https://wa.me/?text=${encodeURIComponent(t + ' ' + u)}` },
  ];

  protected link(target: (typeof this.targets)[number]): string {
    return target.href(this.url(), this.title);
  }

  protected async copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.url());
      this.copied.set(true);
      this.toasts.success('Link copied');
      setTimeout(() => this.copied.set(false), 1600);
    } catch {
      this.toasts.error('Could not copy the link');
    }
  }

  /**
   * Uses the operating system's own share sheet where it exists — on a phone
   * that means the real share menu, which beats any list we could draw.
   */
  protected async native(): Promise<void> {
    if (!navigator.share) return;

    try {
      await navigator.share({ title: this.title, url: this.url() });
      this.closed.emit();
    } catch {
      // The user dismissed it. Not an error.
    }
  }

  protected get hasNative(): boolean {
    return typeof navigator !== 'undefined' && !!navigator.share;
  }

  protected close(): void {
    this.closed.emit();
  }
}

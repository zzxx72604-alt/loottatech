import { ChangeDetectionStrategy, Component, HostListener, computed, signal } from '@angular/core';

type Panel = 'qr' | 'chat' | null;

/**
 * The fixed rail down the right edge: app QR code, support chat, back to top.
 *
 * Both panels are honest about being demos. A chat widget that looks real and
 * silently drops messages is worse than one that says it isn't connected yet —
 * the first wastes a customer's time, the second sets expectations.
 */
@Component({
  selector: 'app-side-rail',
  templateUrl: './side-rail.html',
  styleUrl: './side-rail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SideRail {
  protected readonly panel = signal<Panel>(null);

  /** Only shown once there is somewhere to scroll back to. */
  protected readonly scrolled = signal(false);

  protected readonly isOpen = computed(() => this.panel() !== null);

  protected toggle(which: Exclude<Panel, null>): void {
    this.panel.update((current) => (current === which ? null : which));
  }

  protected close(): void {
    this.panel.set(null);
  }

  protected toTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /*
   * Passive listener: it tells the browser this handler will never call
   * preventDefault, so scrolling is never blocked waiting for it to finish.
   */
  @HostListener('window:scroll', [])
  protected onScroll(): void {
    this.scrolled.set(window.scrollY > 400);
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.close();
  }
}

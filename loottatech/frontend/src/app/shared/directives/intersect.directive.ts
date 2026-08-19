import {
  DestroyRef,
  Directive,
  ElementRef,
  EventEmitter,
  Input,
  OnInit,
  Output,
  inject,
} from '@angular/core';

/**
 * Emits when the host element scrolls into view.
 *
 * Uses IntersectionObserver rather than a scroll listener. A scroll handler
 * fires on every pixel and has to measure the element each time, which is the
 * classic cause of janky infinite scroll. The observer is told once what to
 * watch for and stays silent until it happens.
 *
 * The observer is disconnected when the element is destroyed, so navigating
 * away leaves nothing behind.
 */
@Directive({
  selector: '[appIntersect]',
})
export class IntersectDirective implements OnInit {
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly destroyRef = inject(DestroyRef);

  /** Starts loading slightly before the element is actually visible. */
  @Input() rootMargin = '300px';

  @Output() appIntersect = new EventEmitter<void>();

  ngOnInit(): void {
    // Server-side rendering or very old browsers: fail quietly rather than
    // breaking the page.
    if (typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) this.appIntersect.emit();
        }
      },
      { rootMargin: this.rootMargin },
    );

    observer.observe(this.host.nativeElement);
    this.destroyRef.onDestroy(() => observer.disconnect());
  }
}

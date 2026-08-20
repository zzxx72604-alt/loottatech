import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnDestroy,
  Output,
  ViewChild,
  signal,
} from '@angular/core';

export interface CropResult {
  x: number;
  y: number;
  size: number;
}

/**
 * Chooses the square that will be kept from an uploaded photo.
 *
 * The box is reported as FRACTIONS of the image, not pixels, because this
 * preview is scaled to fit the dialog. Sending pixels would mean doing the
 * scaling maths in two places and getting it wrong in one of them.
 */
@Component({
  selector: 'app-crop-dialog',
  templateUrl: './crop-dialog.html',
  styleUrl: './crop-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CropDialog implements AfterViewInit, OnDestroy {
  @ViewChild('frame') private frame!: ElementRef<HTMLElement>;

  @Input({ required: true }) file!: File;
  @Output() cropped = new EventEmitter<CropResult>();
  @Output() cancelled = new EventEmitter<void>();

  protected readonly preview = signal('');

  /** Box position and size, all as fractions of the displayed image. */
  protected readonly x = signal(0);
  protected readonly y = signal(0);
  protected readonly size = signal(1);

  private dragging = false;
  private startX = 0;
  private startY = 0;
  private originX = 0;
  private originY = 0;

  ngAfterViewInit(): void {
    this.preview.set(URL.createObjectURL(this.file));
  }

  ngOnDestroy(): void {
    // Releasing the blob matters: without this the whole file stays in memory
    // for as long as the tab is open.
    const url = this.preview();
    if (url) URL.revokeObjectURL(url);
  }

  /** Once the image is measured, start with the largest centred square. */
  protected onImageLoad(event: Event): void {
    const img = event.target as HTMLImageElement;
    const wide = img.naturalWidth >= img.naturalHeight;

    // The square is expressed against the SHORTER edge, so a value of 1 is
    // always the biggest square that fits.
    this.size.set(1);
    this.x.set(wide ? (1 - img.naturalHeight / img.naturalWidth) / 2 : 0);
    this.y.set(wide ? 0 : (1 - img.naturalWidth / img.naturalHeight) / 2);
  }

  protected boxStyle(): Record<string, string> {
    const frame = this.frame?.nativeElement;
    if (!frame) return {};

    const shorter = Math.min(frame.clientWidth, frame.clientHeight);
    const px = this.size() * shorter;

    return {
      left: `${this.x() * frame.clientWidth}px`,
      top: `${this.y() * frame.clientHeight}px`,
      width: `${px}px`,
      height: `${px}px`,
    };
  }

  /* --------------------------------------------------------- dragging */

  protected onPointerDown(event: PointerEvent): void {
    this.dragging = true;
    this.startX = event.clientX;
    this.startY = event.clientY;
    this.originX = this.x();
    this.originY = this.y();

    // Capture, so the drag keeps working if the pointer leaves the box.
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
  }

  protected onPointerMove(event: PointerEvent): void {
    if (!this.dragging) return;

    const frame = this.frame.nativeElement;
    const dx = (event.clientX - this.startX) / frame.clientWidth;
    const dy = (event.clientY - this.startY) / frame.clientHeight;

    const shorter = Math.min(frame.clientWidth, frame.clientHeight);
    const boxW = (this.size() * shorter) / frame.clientWidth;
    const boxH = (this.size() * shorter) / frame.clientHeight;

    this.x.set(Math.min(Math.max(this.originX + dx, 0), Math.max(0, 1 - boxW)));
    this.y.set(Math.min(Math.max(this.originY + dy, 0), Math.max(0, 1 - boxH)));
  }

  protected onPointerUp(): void {
    this.dragging = false;
  }

  protected onSizeChange(value: string): void {
    this.size.set(Number(value) / 100);
    // Re-clamp: shrinking is safe, growing can push the box off the edge.
    this.onPointerMoveClamp();
  }

  private onPointerMoveClamp(): void {
    const frame = this.frame.nativeElement;
    const shorter = Math.min(frame.clientWidth, frame.clientHeight);
    const boxW = (this.size() * shorter) / frame.clientWidth;
    const boxH = (this.size() * shorter) / frame.clientHeight;

    this.x.update((v) => Math.min(v, Math.max(0, 1 - boxW)));
    this.y.update((v) => Math.min(v, Math.max(0, 1 - boxH)));
  }

  protected confirm(): void {
    this.cropped.emit({ x: this.x(), y: this.y(), size: this.size() });
  }
}

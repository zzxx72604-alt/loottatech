import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Input,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { HttpEventType } from '@angular/common/http';
import { ProductApi } from '../../core/services/product-api.service';
import { ProductImage } from '../../shared/models/product';
import { environment } from '../../../environments/environment';

/**
 * Manages a product's photos: upload, replace, reorder-by-primary, delete.
 *
 * Two things are worth noticing in here:
 *
 *  1. A local preview is shown from a blob URL the instant a file is picked,
 *     before the upload finishes. The page feels immediate even on slow
 *     connections. Those URLs are revoked afterwards — a forgotten blob URL
 *     pins the whole file in memory for the life of the tab.
 *
 *  2. The square crop is done by the SERVER. This component shows a square
 *     preview so the admin can see what will be kept, but it never sends a
 *     cropped file — a client-side crop can always be skipped.
 */
@Component({
  selector: 'app-image-manager',
  templateUrl: './image-manager.html',
  styleUrl: './image-manager.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImageManager {
  private readonly api = inject(ProductApi);

  @ViewChild('picker') private picker!: ElementRef<HTMLInputElement>;

  /** Null while creating — images need a saved product to attach to. */
  @Input() productId: number | null = null;

  @Input() set images(value: ProductImage[]) {
    this.list.set([...(value ?? [])]);
  }

  protected readonly list = signal<ProductImage[]>([]);
  protected readonly busy = signal(false);
  protected readonly progress = signal(0);
  protected readonly error = signal('');

  /** Blob URL of the file being uploaded, shown until the server replies. */
  protected readonly pendingPreview = signal<string | null>(null);

  /** Set when the picker is replacing a specific image rather than adding. */
  private replacingId: number | null = null;

  protected readonly fileBase = environment.fileBase;

  protected readonly sorted = computed(() =>
    [...this.list()].sort(
      (a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.sortOrder - b.sortOrder,
    ),
  );

  protected thumb(image: ProductImage): string {
    return `${this.fileBase}${image.url}-480.webp`;
  }

  /* ------------------------------------------------------------ picking */

  protected add(): void {
    this.replacingId = null;
    this.picker.nativeElement.click();
  }

  protected replace(image: ProductImage): void {
    this.replacingId = image.id;
    this.picker.nativeElement.click();
  }

  protected onFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    // Reset immediately so picking the same file twice still fires a change.
    input.value = '';

    if (!file || !this.productId) return;

    this.error.set('');
    this.busy.set(true);
    this.progress.set(0);
    this.pendingPreview.set(URL.createObjectURL(file));

    const request = this.replacingId
      ? this.api.replaceImage(this.productId, this.replacingId, file)
      : this.api.uploadImage(this.productId, file);

    const wasReplacing = this.replacingId;
    this.replacingId = null;

    request.subscribe({
      next: (event) => {
        if (event.type === HttpEventType.UploadProgress && event.total) {
          this.progress.set(Math.round((event.loaded / event.total) * 100));
        }

        if (event.type === HttpEventType.Response && event.body) {
          const saved = event.body;

          this.list.update((images) =>
            wasReplacing
              ? images.map((i) => (i.id === saved.id ? saved : i))
              : [...images, saved],
          );

          this.finish();
        }
      },
      error: (err) => {
        const e = err as { status?: number; error?: unknown };
        this.error.set(
          typeof e.error === 'string' && e.error
            ? e.error
            : `Upload failed with status ${e.status ?? 'unknown'}.`,
        );
        this.finish();
      },
    });
  }

  /* ------------------------------------------------------------ actions */

  protected setPrimary(image: ProductImage): void {
    if (!this.productId || image.isPrimary) return;

    this.api.setPrimaryImage(this.productId, image.id).subscribe({
      next: () =>
        this.list.update((images) =>
          images.map((i) => ({ ...i, isPrimary: i.id === image.id })),
        ),
      error: () => this.error.set('Could not set the card photo.'),
    });
  }

  protected remove(image: ProductImage): void {
    if (!this.productId) return;
    if (!confirm('Delete this photo? The files are removed from the server.')) return;

    this.api.deleteImage(this.productId, image.id).subscribe({
      next: () => {
        this.list.update((images) => images.filter((i) => i.id !== image.id));

        // Mirror the server: if the card photo went, promote the next one.
        if (image.isPrimary) {
          this.list.update((images) =>
            images.map((i, index) => ({ ...i, isPrimary: index === 0 })),
          );
        }
      },
      error: () => this.error.set('Could not delete the photo.'),
    });
  }

  private finish(): void {
    const preview = this.pendingPreview();
    // Release the blob, or the browser keeps the whole file in memory.
    if (preview) URL.revokeObjectURL(preview);

    this.pendingPreview.set(null);
    this.busy.set(false);
    this.progress.set(0);
  }
}

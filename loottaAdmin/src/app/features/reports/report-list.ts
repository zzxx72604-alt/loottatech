import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ReportApi } from '../../core/services/report-api.service';
import { Report } from '../../shared/models/report';

/**
 * The moderation queue.
 *
 * Deliberately shows open reports first and requires a decision — actioned or
 * dismissed — rather than letting them be silently cleared. A queue you can
 * empty without deciding anything is not a queue.
 */
@Component({
  selector: 'app-report-list',
  imports: [DatePipe, RouterLink],
  templateUrl: './report-list.html',
  styleUrl: './report-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportList {
  private readonly api = inject(ReportApi);

  protected readonly rows = signal<Report[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly openOnly = signal(true);

  protected readonly openCount = computed(() => this.rows().filter((r) => r.status === 'Open').length);

  constructor() {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set('');

    this.api.list(this.openOnly()).subscribe({
      next: (rows) => {
        this.rows.set(rows);
        this.loading.set(false);
      },
      error: (err) => {
        const e = err as { status?: number };
        this.error.set(
          e.status === 0
            ? 'Cannot reach the API. Is it running on http://localhost:5197 ?'
            : `Request failed with status ${e.status ?? 'unknown'}.`,
        );
        this.loading.set(false);
      },
    });
  }

  protected toggleFilter(): void {
    this.openOnly.update((v) => !v);
    this.load();
  }

  protected resolve(report: Report, status: 'Actioned' | 'Dismissed'): void {
    const note = prompt(
      status === 'Actioned'
        ? 'What did you do about it?'
        : 'Why is this being dismissed?',
      '',
    );

    // Cancel means cancel; an empty string is still a valid short note.
    if (note === null) return;

    this.api.resolve(report.id, status, note).subscribe({
      next: () => {
        if (this.openOnly()) {
          this.rows.update((list) => list.filter((r) => r.id !== report.id));
        } else {
          this.rows.update((list) =>
            list.map((r) => (r.id === report.id ? { ...r, status, resolution: note } : r)),
          );
        }
      },
      error: () => this.error.set('Could not save that decision.'),
    });
  }

  protected linkFor(report: Report): string[] {
    return report.target === 'Product' ? ['/products', String(report.targetId)] : ['/reviews'];
  }
}

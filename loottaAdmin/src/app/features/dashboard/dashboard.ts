import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { DashboardApi } from '../../core/services/dashboard-api.service';
import { Dashboard } from '../../shared/models/dashboard';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-dashboard',
  imports: [CurrencyPipe, DatePipe, RouterLink],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardPage {
  private readonly api = inject(DashboardApi);
  private readonly fileBase = environment.fileBase;

  protected readonly data = signal<Dashboard | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal('');

  /** Tallest bar sets the scale, so the chart always fills its space. */
  protected readonly maxStatus = computed(() => {
    const d = this.data();
    if (!d) return 1;
    return Math.max(1, ...d.byStatus.map((s) => s.count));
  });

  constructor() {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set('');

    this.api.get().subscribe({
      next: (data) => {
        this.data.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        const e = err as { status?: number };
        this.error.set(
          e.status === 0
            ? 'Cannot reach the API. Is it running on http://localhost:5197 ?'
            : 'Could not load the dashboard.',
        );
        this.loading.set(false);
      },
    });
  }

  protected barHeight(count: number): string {
    return `${Math.round((count / this.maxStatus()) * 100)}%`;
  }

  protected image(url: string): string {
    return url ? `${this.fileBase}${url}-480.webp` : '';
  }

  protected statusClass(status: string): string {
    return 's-' + status.toLowerCase();
  }
}

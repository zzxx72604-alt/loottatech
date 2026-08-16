import { Injectable, effect, signal } from '@angular/core';

export type Theme = 'light' | 'dark';
const STORAGE_KEY = 'lootta-theme';

/**
 * State held in a signal (not a BehaviourSubject), so any component can read
 * `theme()` directly in its template and Angular keeps it in sync.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly theme = signal<Theme>(this.initial());

  constructor() {
    // Runs whenever the signal changes — writes the attribute CSS reads from.
    effect(() => {
      const value = this.theme();
      document.documentElement.setAttribute('data-theme', value);
      localStorage.setItem(STORAGE_KEY, value);
    });
  }

  toggle(): void {
    this.theme.update((current) => (current === 'dark' ? 'light' : 'dark'));
  }

  private initial(): Theme {
    const saved = localStorage.getItem(STORAGE_KEY) as Theme | null;
    if (saved === 'light' || saved === 'dark') return saved;

    // Default to light. The brand is built around a bright yellow, which only
    // reads correctly on a light background — so we don't follow the OS setting
    // unless the visitor explicitly picks dark.
    return 'light';
  }
}

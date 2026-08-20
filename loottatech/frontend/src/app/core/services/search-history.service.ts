import { Injectable, signal } from '@angular/core';

const KEY = 'lootta-search-history';
const LIMIT = 8;

/**
 * Recent searches, kept on the device.
 *
 * Deliberately not on the account: a search history is a record of what
 * someone was curious about, and it is the sort of thing people expect to be
 * able to clear. Keeping it local means "delete" actually deletes it, rather
 * than hiding a row that still exists on a server.
 */
@Injectable({ providedIn: 'root' })
export class SearchHistoryService {
  private readonly terms = signal<string[]>(this.restore());
  readonly recent = this.terms.asReadonly();

  add(term: string): void {
    const value = term.trim();
    if (value.length < 2) return;

    this.terms.update((list) => {
      // Repeat searches move to the front instead of piling up.
      const without = list.filter((t) => t.toLowerCase() !== value.toLowerCase());
      return [value, ...without].slice(0, LIMIT);
    });

    this.persist();
  }

  remove(term: string): void {
    this.terms.update((list) => list.filter((t) => t !== term));
    this.persist();
  }

  clear(): void {
    this.terms.set([]);
    this.persist();
  }

  private persist(): void {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.terms()));
    } catch {
      // Private browsing or a full quota must not break searching.
    }
  }

  private restore(): string[] {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  }
}

import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

const THEME_KEY = 'lootta_theme';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  private darkSubject: BehaviorSubject<boolean>;
  public isDark$;

  constructor() {
    const saved = localStorage.getItem(THEME_KEY);
    const prefersDark =
      saved === 'dark' ||
      (saved === null &&
        window.matchMedia &&
        window.matchMedia('(prefers-color-scheme: dark)').matches);
    this.darkSubject = new BehaviorSubject<boolean>(prefersDark);
    this.isDark$ = this.darkSubject.asObservable();
    this.apply(prefersDark);
  }

  get isDark(): boolean {
    return this.darkSubject.value;
  }

  toggle(): void {
    this.setDark(!this.darkSubject.value);
  }

  setDark(dark: boolean): void {
    this.darkSubject.next(dark);
    localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light');
    this.apply(dark);
  }

  private apply(dark: boolean): void {
    const body = document.body;
    if (dark) body.classList.add('dark-theme');
    else body.classList.remove('dark-theme');
  }
}

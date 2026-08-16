import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { IMAGE_LOADER, ImageLoaderConfig } from '@angular/common';

import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';

/**
 * Custom loader for NgOptimizedImage.
 *
 * Templates write the base path only:
 *     <img ngSrc="/products/thinkpad-e14-1" ngSrcset="480w, 800w" ... />
 *
 * Angular then asks this function for a URL at each width, and it returns the
 * matching pre-generated webp:
 *     /products/thinkpad-e14-1-480.webp     ~10 kB   phones
 *     /products/thinkpad-e14-1-800.webp     ~20 kB   desktop
 *
 * The browser picks one from the srcset, so a phone never downloads the big file.
 */
export function loottaImageLoader(config: ImageLoaderConfig): string {
  const width = config.width ?? 800;
  return `${config.src}-${width}.webp`;
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),

    provideRouter(
      routes,
      withComponentInputBinding(),
      withInMemoryScrolling({ scrollPositionRestoration: 'top' }),
    ),

    provideHttpClient(withFetch(), withInterceptors([authInterceptor])),

    { provide: IMAGE_LOADER, useValue: loottaImageLoader },
  ],
};

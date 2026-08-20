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
  /*
   * Only two widths were ever generated, so only two may be asked for. A
   * template that sets width and height without ngSrcset gets a 1x/2x srcset
   * from Angular instead, and on a screen at 150% scaling the browser then
   * wants a "-960.webp" that was never written — a broken thumbnail on every
   * HiDPI laptop. Anything above 480 rounds to the 800.
   */
  const width = config.width ?? 800;
  return `${config.src}-${width <= 480 ? 480 : 800}.webp`;
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

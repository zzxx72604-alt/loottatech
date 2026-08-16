/** How worn a second-hand item is. Drives the badge and justifies the price. */
export type Condition = 'new' | 'like-new' | 'good' | 'fair';

/** One row of the dynamic spec table (built with a FormArray in the admin form). */
export interface Spec {
  key: string;
  value: string;
}

export interface Product {
  /** Integer primary key from SQL Server, not a Mongo ObjectId. */
  id: number;
  title: string;
  brand: string;
  category: string;
  condition: Condition;

  price: number;
  /** Retail price when new. 0 means "no original price to show". */
  originalPrice: number;

  /**
   * Base paths without a size suffix or extension, e.g. "/products/vxe-mouse-1".
   * Use `imageSrc()` / `imageSrcset()` below to build the real URLs.
   */
  images: string[];
  specs: Spec[];

  stock: number;
  warrantyMonths: number;
  tested: boolean;
  watchCount: number;
  categoryId: number;
  isActive: boolean;

  description?: string;
  /** Honest photos of scratches and dents — the trust signal for used goods. */
  flawNotes?: string;
}

export const CONDITION_LABEL: Record<Condition, string> = {
  new: 'Brand new',
  'like-new': 'Almost new',
  good: 'Good',
  fair: 'Fair',
};

export const CATEGORIES = [
  'Phones',
  'Laptops',
  'Tablets',
  'Cameras',
  'Audio',
  'Gaming',
  'Wearables',
  'Components',
  'Accessories',
  'Drones',
] as const;

export type Category = (typeof CATEGORIES)[number];

/** Discount percentage — one place, so nothing drifts. */
export function discountPercent(p: Product): number {
  if (!p.originalPrice || p.originalPrice <= p.price) return 0;
  return Math.round(((p.originalPrice - p.price) / p.originalPrice) * 100);
}

/* ---------------------------------------------------------------- images --

   Every photo exists at three sizes, generated once when it is uploaded:

     /products/vxe-mouse-1-480.webp   ~4 kB   phones
     /products/vxe-mouse-1-800.webp   ~8 kB   tablets & desktop
     /products/vxe-mouse-1.jpg       ~25 kB   fallback

   The browser picks one from the srcset, so a phone downloads 4 kB instead of
   the 65 kB original. Across the seed catalogue that's 87% less image traffic.
   ------------------------------------------------------------------------- */

export const IMAGE_WIDTHS = [480, 800] as const;

/** Default `src` — the 800px webp. */
export function imageSrc(base: string): string {
  return `${base}-800.webp`;
}

/** `srcset` so the browser downloads the size it actually needs. */
export function imageSrcset(base: string): string {
  return IMAGE_WIDTHS.map((w) => `${base}-${w}.webp ${w}w`).join(', ');
}

/** Original-format fallback, used if webp ever fails to load. */
export function imageFallback(base: string): string {
  return `${base}.jpg`;
}

export const PLACEHOLDER_IMAGE = '/products/placeholder-800.webp';

export function primaryImage(p: Product): string {
  return p.images?.length ? imageSrc(p.images[0]) : PLACEHOLDER_IMAGE;
}

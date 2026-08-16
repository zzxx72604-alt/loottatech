/** Matches the ASP.NET Core DTOs exactly. Ids are integers from SQL Server. */

export type Condition = 'new' | 'like-new' | 'good' | 'fair';

export const CONDITIONS: { value: Condition; label: string; isNew: boolean }[] = [
  { value: 'new', label: 'Brand new', isNew: true },
  { value: 'like-new', label: 'Used — almost new', isNew: false },
  { value: 'good', label: 'Used — good', isNew: false },
  { value: 'fair', label: 'Used — fair', isNew: false },
];

export interface Spec {
  key: string;
  value: string;
}

export interface ProductImage {
  id: number;
  url: string;
  isPrimary: boolean;
  sortOrder: number;
}

export interface Product {
  id: number;
  title: string;
  brand: string;
  category: string;
  categoryId: number;
  condition: Condition;
  price: number;
  originalPrice: number;
  stock: number;
  warrantyMonths: number;
  tested: boolean;
  watchCount: number;
  isActive: boolean;
  /** Base paths without size suffix, e.g. "/uploads/products/vxe-mouse-1". */
  images: string[];
}

export interface ProductDetail extends Product {
  description: string;
  flawNotes: string;
  specs: Spec[];
  imageDetails: ProductImage[];
}

/** Body for POST and PUT — mirrors ProductWriteDto on the API. */
export interface ProductWrite {
  title: string;
  brand: string;
  categoryId: number;
  condition: Condition;
  price: number;
  originalPrice: number;
  stock: number;
  warrantyMonths: number;
  tested: boolean;
  isActive: boolean;
  description: string;
  flawNotes: string;
  specs: Spec[];
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  sortOrder: number;
  productCount: number;
}

export function conditionLabel(condition: Condition): string {
  return CONDITIONS.find((c) => c.value === condition)?.label ?? condition;
}

export function isNewProduct(condition: Condition): boolean {
  return condition === 'new';
}

import { Schema, model } from 'mongoose';

/** How worn a second-hand item is — drives the badge and justifies the price. */
export type Condition = 'new' | 'like-new' | 'good' | 'fair';

/** One row of the dynamic spec table (built with a FormArray in the admin form). */
export interface Spec {
  key: string;
  value: string;
}

export interface Product {
  id: string;
  title: string;
  brand: string;
  category: string;
  condition: Condition;

  price: number;
  originalPrice: number;

  /**
   * Base image paths WITHOUT a size suffix or extension,
   * e.g. "/products/iphone-12-mini-1".
   *
   * The frontend appends "-480.webp" / "-800.webp" for the responsive srcset
   * and falls back to ".jpg". Uploads generate the same three variants, so
   * seeded and uploaded images behave identically.
   */
  images: string[];

  specs: Spec[];

  stock: number;
  warrantyMonths: number;
  tested: boolean;
  watchCount: number;

  description: string;
  /** Honest note about scratches or dents — the trust signal for used goods. */
  flawNotes: string;

  sortOrder: number;
}

const SpecSchema = new Schema<Spec>(
  {
    key: { type: String, required: true },
    value: { type: String, required: true },
  },
  { _id: false },
);

export const ProductSchema = new Schema<Product>(
  {
    title: { type: String, required: true },
    brand: { type: String, required: true },
    category: { type: String, required: true, index: true },
    condition: {
      type: String,
      required: true,
      enum: ['new', 'like-new', 'good', 'fair'],
      index: true,
    },

    price: { type: Number, required: true, index: true },
    originalPrice: { type: Number, default: 0 },

    images: { type: [String], required: true },
    specs: { type: [SpecSchema], default: [] },

    stock: { type: Number, default: 1 },
    warrantyMonths: { type: Number, default: 0 },
    tested: { type: Boolean, default: true },
    watchCount: { type: Number, default: 0 },

    description: { type: String, default: '' },
    flawNotes: { type: String, default: '' },

    sortOrder: { type: Number, default: 0 },
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
    timestamps: true,
  },
);

// Text index so /search can match title, brand and description together.
ProductSchema.index({ title: 'text', brand: 'text', description: 'text' });

export const ProductModel = model<Product>('product', ProductSchema);

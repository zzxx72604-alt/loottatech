import { model, Schema, Types } from 'mongoose';
import { DeliveryOption, OrderStatus } from '../constants/order_status';

/**
 * A line in an order is a SNAPSHOT, not a reference.
 *
 * We copy the title, image and price at the moment of purchase. If the shop
 * later drops the price or renames the item, old orders must still show what
 * the customer actually agreed to pay. Referencing the live product would
 * silently rewrite history.
 */
export interface OrderItem {
  productId: string;
  title: string;
  image: string;
  condition: string;
  price: number;
  quantity: number;
}

export const OrderItemSchema = new Schema<OrderItem>(
  {
    productId: { type: String, required: true },
    title: { type: String, required: true },
    image: { type: String, required: true },
    condition: { type: String, required: true },
    price: { type: Number, required: true },
    quantity: { type: Number, required: true, min: 1 },
  },
  { _id: false },
);

export interface Order {
  id: string;
  orderNumber: string;

  items: OrderItem[];
  subtotal: number;
  deliveryFee: number;
  discount: number;
  totalPrice: number;

  // Customer details are captured on the order itself, so a guest can buy
  // without an account.
  customerName: string;
  phone: string;
  address: string;
  deliveryOption: DeliveryOption;
  note: string;

  /** Set only when the buyer was signed in. Guests leave this empty. */
  user?: Types.ObjectId;

  status: OrderStatus;
  archived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const orderSchema = new Schema<Order>(
  {
    orderNumber: { type: String, required: true, unique: true, index: true },

    items: { type: [OrderItemSchema], required: true },
    subtotal: { type: Number, required: true },
    deliveryFee: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    totalPrice: { type: Number, required: true },

    customerName: { type: String, required: true },
    phone: { type: String, required: true },
    address: { type: String, required: true },
    deliveryOption: {
      type: String,
      enum: Object.values(DeliveryOption),
      default: DeliveryOption.STANDARD,
    },
    note: { type: String, default: '' },

    // Optional — this is what makes guest checkout possible.
    user: { type: Schema.Types.ObjectId, required: false, index: true },

    status: {
      type: String,
      enum: Object.values(OrderStatus),
      default: OrderStatus.PENDING,
      index: true,
    },
    archived: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

export const OrderModel = model<Order>('order', orderSchema);

/** Short human-readable code shown to the customer, e.g. "LT-7K3QA2". */
export function makeOrderNumber(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no confusing I/O/0/1
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `LT-${code}`;
}

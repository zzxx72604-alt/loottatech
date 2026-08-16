/** Mirrors the OrderStatus enum and DTOs in the ASP.NET Core API. */

export type OrderStatus =
  | 'Pending'
  | 'Confirmed'
  | 'Preparing'
  | 'Shipping'
  | 'Completed'
  | 'Cancelled';

export const ORDER_STATUSES: OrderStatus[] = [
  'Pending',
  'Confirmed',
  'Preparing',
  'Shipping',
  'Completed',
  'Cancelled',
];

/** The normal progression. Cancelled sits outside it. */
export const STATUS_FLOW: OrderStatus[] = [
  'Pending',
  'Confirmed',
  'Preparing',
  'Shipping',
  'Completed',
];

export interface OrderSummary {
  id: number;
  orderNumber: string;
  customerName: string;
  phone: string;
  deliveryOption: string;
  totalPrice: number;
  itemCount: number;
  status: OrderStatus;
  createdAt: string;
}

export interface OrderItem {
  productId: number | null;
  title: string;
  image: string;
  condition: string;
  price: number;
  quantity: number;
  lineTotal: number;
}

export interface Order extends OrderSummary {
  address: string;
  note: string;
  subtotal: number;
  deliveryFee: number;
  discount: number;
  items: OrderItem[];
}

/** The next sensible status, so the admin can advance an order in one click. */
export function nextStatus(current: OrderStatus): OrderStatus | null {
  const index = STATUS_FLOW.indexOf(current);
  if (index === -1 || index === STATUS_FLOW.length - 1) return null;
  return STATUS_FLOW[index + 1];
}

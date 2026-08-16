/** Mirrors the OrderStatus enum in the ASP.NET Core API. */
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

export type DeliveryOption = 'Standard Delivery' | 'Same-Day Delivery' | 'Store Pickup';

export const DELIVERY_OPTIONS: { value: DeliveryOption; label: string; fee: number; note: string }[] =
  [
    { value: 'Standard Delivery', label: 'Standard Delivery', fee: 2, note: '2–3 days' },
    { value: 'Same-Day Delivery', label: 'Same-Day Delivery', fee: 5, note: 'Phnom Penh only' },
    { value: 'Store Pickup', label: 'Store Pickup', fee: 0, note: 'Collect in store, free' },
  ];

export interface OrderItem {
  productId: number | null;
  title: string;
  image: string;
  condition: string;
  price: number;
  quantity: number;
}

export interface Order {
  id: number;
  orderNumber: string;
  items: OrderItem[];
  subtotal: number;
  deliveryFee: number;
  discount: number;
  totalPrice: number;
  customerName: string;
  phone: string;
  address: string;
  deliveryOption: DeliveryOption;
  note: string;
  voucherCode: string;
  status: OrderStatus;
  createdAt: string;
}

export interface CreateOrderRequest {
  items: { productId: number; quantity: number }[];
  /** Code only. The server looks up what it is worth. */
  voucherCode?: string;
  customerName: string;
  phone: string;
  address: string;
  deliveryOption: DeliveryOption;
  note?: string;
}

/** What POST /api/orders/preview returns — the server's pricing, not ours. */
export interface OrderPreview {
  subtotal: number;
  deliveryFee: number;
  discount: number;
  total: number;
  coinsEarned: number;
  voucherApplied: boolean;
  voucherMessage: string;
}

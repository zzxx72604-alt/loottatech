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

/** Where an order stands with the customer's money. */
export type RefundState =
  | 'None'
  | 'Requested'
  | 'Declined'
  /** Agreed, but the item is with the customer and has to come back first. */
  | 'ReturnPending'
  /** They said how it is travelling; the shop is waiting for it. */
  | 'ReturnArranged'
  | 'Refunded';

/** How a returned item gets back to the shop. */
export type ReturnMethod = 'DropOff' | 'CourierPickup';

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
  paymentMethod: string;
  isPaid: boolean;
  status: OrderStatus;
  refund: RefundState;
  /** Withheld from a guest tracking by code. */
  refundReason: string;
  /** Evidence photos, base paths. Withheld from a guest too. */
  refundPhotos: string[];
  refundRequestedAt: string | null;
  refundDecidedAt: string | null;
  refundedAt: string | null;

  returnMethod: ReturnMethod | '';
  returnAddress: string;
  returnNote: string;
  returnArrangedAt: string | null;

  /** What the order is worth in coins, and whether they have been paid. */
  coinsEarned: number;
  coinsCredited: boolean;
  /** The API decides this: only the buyer, and only while it would be taken. */
  canRequestRefund: boolean;
  createdAt: string;
}

/**
 * One row of the order list.
 *
 * Both sources — the signed-in account and the guest codes kept in this
 * browser — are reduced to this shape, so the list does not need to know
 * where any given row came from.
 */
export interface OrderSummary {
  id: number;
  orderNumber: string;
  itemCount: number;
  totalPrice: number;
  status: OrderStatus;
  refund: RefundState;
  createdAt: string;
}

export interface PaymentOption {
  value: string;
  label: string;
  note: string;
  group: string;
}

export interface CreateOrderRequest {
  items: { productId: number; quantity: number }[];
  /** Code only. The server looks up what it is worth. */
  voucherCode?: string;
  /** How they intend to pay. No money moves at checkout. */
  paymentMethod?: string;
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

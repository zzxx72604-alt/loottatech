export type OrderStatus =
  | 'Pending'
  | 'Confirmed'
  | 'Preparing'
  | 'Out for Delivery'
  | 'Delivered'
  | 'Cancelled';

export const ORDER_STATUSES: OrderStatus[] = [
  'Pending',
  'Confirmed',
  'Preparing',
  'Out for Delivery',
  'Delivered',
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
  productId: string;
  title: string;
  image: string;
  condition: string;
  price: number;
  quantity: number;
}

export interface Order {
  id: string;
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
  status: OrderStatus;
  createdAt: string;
}

export interface CreateOrderRequest {
  items: { productId: string; quantity: number }[];
  customerName: string;
  phone: string;
  address: string;
  deliveryOption: DeliveryOption;
  note?: string;
}

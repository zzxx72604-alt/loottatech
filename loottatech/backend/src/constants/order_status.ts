export enum OrderStatus {
  PENDING = 'Pending',
  CONFIRMED = 'Confirmed',
  PREPARING = 'Preparing',
  OUT_FOR_DELIVERY = 'Out for Delivery',
  DELIVERED = 'Delivered',
  CANCELLED = 'Cancelled',
}

/** The order a status can move through — used to validate admin changes. */
export const ORDER_STATUS_FLOW: OrderStatus[] = [
  OrderStatus.PENDING,
  OrderStatus.CONFIRMED,
  OrderStatus.PREPARING,
  OrderStatus.OUT_FOR_DELIVERY,
  OrderStatus.DELIVERED,
];

export enum DeliveryOption {
  STANDARD = 'Standard Delivery',
  SAME_DAY = 'Same-Day Delivery',
  PICKUP = 'Store Pickup',
}

export const DELIVERY_FEE: Record<DeliveryOption, number> = {
  [DeliveryOption.STANDARD]: 2,
  [DeliveryOption.SAME_DAY]: 5,
  [DeliveryOption.PICKUP]: 0,
};

export interface AdminReview {
  id: number;
  productId: number;
  productTitle: string;
  customerId: number;
  customerName: string;
  rating: number;
  body: string;
  imageUrl: string;
  verifiedPurchase: boolean;
  isHidden: boolean;
  createdAt: string;
}

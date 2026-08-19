export interface Review {
  id: number;
  rating: number;
  body: string;
  /** Base path; the client appends -480.webp. Empty when there's no photo. */
  imageUrl: string;
  verifiedPurchase: boolean;
  createdAt: string;
  author: string;
  isMine: boolean;
}

export interface RatingSummary {
  average: number;
  count: number;
  /** Index 0 is one star. */
  distribution: number[];
  percentages: number[];

  canReview: boolean;
  cannotReviewReason: string;
  alreadyReviewed: boolean;
}

export interface ReviewPage {
  summary: RatingSummary;
  reviews: Review[];
  hasMore: boolean;
  total: number;
}

export interface Profile {
  id: number;
  name: string;
  email: string;
  /** Masked by the API, e.g. "0***-3457". */
  phone: string;
  address: string;
  gender: string;
  avatarUrl: string;
  memberSince: string;

  coins: number;
  bestScore: number;
  playStreak: number;

  orderCount: number;
  itemsBought: number;
  totalSpent: number;

  likeCount: number;
  saveCount: number;
  reviewCount: number;

  /** Level, derived by the API from real spending — never stored. */
  exp: number;
  level: number;
  levelTitle: string;
  frame: string;
  levelProgress: number;
  nextTitle: string | null;
  expToNext: number;
}

export interface InteractionState {
  liked: number[];
  saved: number[];
}

export interface ToggleResult {
  productId: number;
  liked: boolean;
  saved: boolean;
  likeCount: number;
}

/** Unmasked details, for the settings form. */
export interface EditableProfile {
  name: string;
  email: string;
  phone: string;
  address: string;
  gender: string;
  avatarUrl: string;
}

export interface Badge {
  key: string;
  title: string;
  description: string;
  icon: string;
  goal: number;
  current: number;
  earned: boolean;
  percent: number;
}

export interface AchievementSet {
  earnedCount: number;
  totalCount: number;
  badges: Badge[];
}

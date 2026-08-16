/** Matches the arcade DTOs in the ASP.NET Core API. */

export interface ArcadeState {
  balance: number;
  streak: number;
  bestScore: number;

  lifetimeItems: number;
  tier: string;
  playsPerDay: number;
  playsLeftToday: number;
  hasWelcomePlay: boolean;

  nextTier: string | null;
  itemsToNextTier: number;

  /** Coin value of each wheel wedge, in drawing order. */
  wheel: number[];
  coinsPerPoint: number;
}

export interface SpinResult {
  prizeIndex: number;
  coinsWon: number;
  dailyBonus: number;
  balance: number;
  streak: number;
  playsLeftToday: number;
  message: string;
}

export interface GameStart {
  token: string;
  coinsPerPoint: number;
  playsLeftToday: number;
  bestScore: number;
}

export interface GameResult {
  score: number;
  coinsEarned: number;
  dailyBonus: number;
  balance: number;
  bestScore: number;
  streak: number;
  playsLeftToday: number;
  newRecord: boolean;
  message: string;
}

export interface VoucherOption {
  key: string;
  label: string;
  description: string;
  coinCost: number;
  affordable: boolean;
}

export interface Voucher {
  id: number;
  code: string;
  label: string;
  type: string;
  value: number;
  minSpend: number;
  expiresAt: string;
  usable: boolean;
  usedAt: string | null;
}

export interface RewardState {
  balance: number;
  streak: number;
  bestScore: number;
  catalog: VoucherOption[];
  vouchers: Voucher[];
}

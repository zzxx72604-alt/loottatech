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
  /** Relative chance of each wedge, so slices can be sized by real odds. */
  wheelWeights: number[];

  playCost: number;
  canAfford: boolean;
  coinsPerPoint: number;
  coinsPerDollar: number;
  bonusPlays: number;
}

export interface UseCodeResult {
  success: boolean;
  message: string;
  coinsAdded: number;
  playsAdded: number;
  balance: number;
  bonusPlays: number;
}

export interface SpinResult {
  prizeIndex: number;
  coinsWon: number;
  playCost: number;
  balance: number;
  streak: number;
  playsLeftToday: number;
  message: string;
}

export interface GameStart {
  token: string;
  coinsPerPoint: number;
  playCost: number;
  balance: number;
  playsLeftToday: number;
  bestScore: number;
}

export interface GameResult {
  score: number;
  coinsEarned: number;
  playCost: number;
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
  value: number;
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

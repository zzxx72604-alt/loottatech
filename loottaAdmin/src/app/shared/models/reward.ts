/** Matches the reward DTOs in the ASP.NET Core API. */

export interface EconomyConfig {
  id: number;
  coinsPerDollar: number;
  playCost: number;
  flyerCoinsPerPoint: number;
  flyerMaxPerRound: number;
  coinsPerVoucherDollar: number;
  voucherMinSpendMultiplier: number;
  voucherExpiryDays: number;
  browserPlays: number;
  bronzeItems: number;
  bronzePlays: number;
  silverItems: number;
  silverPlays: number;
  goldItems: number;
  goldPlays: number;
  welcomeCoins: number;
  updatedAt: string;
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
  userId: number | null;
  isAdminIssued: boolean;
}

export interface RedeemCode {
  id: number;
  code: string;
  coins: number;
  plays: number;
  maxUses: number;
  usedCount: number;
  label: string;
  isActive: boolean;
  usable: boolean;
  expiresAt: string;
  createdAt: string;
}

export interface GrantResult {
  userId: number;
  name: string;
  coins: number;
  bonusPlays: number;
  message: string;
}

export interface CustomerRow {
  id: number;
  name: string;
  email: string;
  role: 'Customer' | 'Admin';
  coins: number;
  isActive: boolean;
  createdAt: string;
  orderCount: number;
}

export interface CustomerOrderRow {
  id: number;
  orderNumber: string;
  totalPrice: number;
  itemCount: number;
  status: string;
  createdAt: string;
}

export interface CustomerDetail {
  id: number;
  name: string;
  email: string;
  role: string;
  phone: string;
  address: string;
  isActive: boolean;
  createdAt: string;

  orderCount: number;
  itemsBought: number;
  totalSpent: number;
  lastOrderAt: string | null;

  coins: number;
  tier: string;
  playsPerDay: number;
  playsUsedToday: number;
  bestScore: number;
  playStreak: number;
  roundsPlayed: number;
  vouchersOwned: number;
  vouchersUsed: number;

  orders: CustomerOrderRow[];
}

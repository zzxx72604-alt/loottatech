import { OrderSummary } from './order';

export interface StatRow {
  id: number;
  title: string;
  image: string;
  /** Stock left, or units sold, depending on which list it came from. */
  value: number;
  amount: number;
}

export interface StatusCount {
  status: string;
  count: number;
}

export interface Dashboard {
  totalRevenue: number;
  revenueThisWeek: number;

  orderCount: number;
  pendingCount: number;
  completedCount: number;
  cancelledCount: number;

  productCount: number;
  activeProductCount: number;
  outOfStockCount: number;

  stockValue: number;

  lowStock: StatRow[];
  bestSellers: StatRow[];
  recentOrders: OrderSummary[];
  byStatus: StatusCount[];
}

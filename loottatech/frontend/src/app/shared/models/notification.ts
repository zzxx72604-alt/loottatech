export interface AppNotification {
  id: number;
  kind: 'Order' | 'Review' | 'Reward' | 'System';
  title: string;
  body: string;
  link: string;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationFeed {
  items: AppNotification[];
  unreadCount: number;
}

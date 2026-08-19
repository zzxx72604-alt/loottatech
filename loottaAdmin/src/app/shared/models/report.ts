export interface Report {
  id: number;
  target: 'Product' | 'Review';
  targetId: number;
  targetLabel: string;
  reason: string;
  details: string;
  status: 'Open' | 'Actioned' | 'Dismissed';
  resolution: string;
  reporterId: number;
  reporterName: string;
  createdAt: string;
  resolvedAt: string | null;
}

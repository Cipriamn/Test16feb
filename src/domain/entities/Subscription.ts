export type SubscriptionStatus = 'verified' | 'unverified' | 'cancelled';

export interface Subscription {
  id: string;
  userId: string;
  connectionId: string;
  name: string;
  amount: number;
  currency: string;
  billingCycle: 'monthly' | 'yearly' | 'weekly';
  nextBillingDate: Date | null;
  status: SubscriptionStatus;
  createdAt: Date;
  updatedAt: Date;
}

export function createSubscription(params: {
  id: string;
  userId: string;
  connectionId: string;
  name: string;
  amount: number;
  currency?: string;
  billingCycle?: 'monthly' | 'yearly' | 'weekly';
  nextBillingDate?: Date | null;
  status?: SubscriptionStatus;
}): Subscription {
  return {
    id: params.id,
    userId: params.userId,
    connectionId: params.connectionId,
    name: params.name,
    amount: params.amount,
    currency: params.currency ?? 'USD',
    billingCycle: params.billingCycle ?? 'monthly',
    nextBillingDate: params.nextBillingDate ?? null,
    status: params.status ?? 'verified',
    createdAt: new Date(),
    updatedAt: new Date()
  };
}
